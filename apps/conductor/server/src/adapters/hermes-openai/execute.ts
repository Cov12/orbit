import { ProxyAgent } from "undici";
import type { AdapterExecutionContext, AdapterExecutionResult } from "../types.js";
import { asString, asNumber } from "../utils.js";
import { extractHandoffTicket } from "./extract-handoff-ticket.js";
import { logger } from "../../middleware/logger.js";

const DEFAULT_URL = "http://100.64.0.10:8642/v1/chat/completions";
const DEFAULT_MODEL = "hermes-agent";
const DEFAULT_API_KEY_ENV = "HERMES_API_KEY";
const DEFAULT_TIMEOUT_SEC = 120;

/**
 * Cached undici ProxyAgent. The Hermes api_server lives on a private tailnet;
 * when Conductor runs behind an egress proxy (Render), `HERMES_OUTBOUND_PROXY`
 * names it and every Hermes call is routed through this dispatcher. We build the
 * agent once per proxy URL rather than per request, and never touch the global
 * dispatcher so only this adapter's fetches are affected.
 */
let cachedProxyUrl: string | undefined;
let cachedProxyAgent: ProxyAgent | undefined;

function getProxyDispatcher(): ProxyAgent | undefined {
  const proxyUrl = process.env.HERMES_OUTBOUND_PROXY;
  if (!proxyUrl) return undefined;
  if (cachedProxyAgent && cachedProxyUrl === proxyUrl) return cachedProxyAgent;
  cachedProxyAgent = new ProxyAgent(proxyUrl);
  cachedProxyUrl = proxyUrl;
  return cachedProxyAgent;
}

/**
 * The bridge sets `taskKey` like `plugin:<key>:session:<sessionId>`. Extract the
 * trailing `<sessionId>` so a conversation maps to a stable Hermes session id.
 * Returns "" when the key is absent or has no `:session:` segment.
 */
function parseSessionIdFromTaskKey(taskKey: string): string {
  const marker = ":session:";
  const idx = taskKey.lastIndexOf(marker);
  if (idx === -1) return "";
  return taskKey.slice(idx + marker.length).trim();
}

function extractAssistantContent(data: unknown): string {
  const choices =
    data && typeof data === "object" && Array.isArray((data as { choices?: unknown }).choices)
      ? (data as { choices: unknown[] }).choices
      : [];
  const first = choices[0];
  const message =
    first && typeof first === "object" ? (first as { message?: unknown }).message : null;
  const content =
    message && typeof message === "object" ? (message as { content?: unknown }).content : null;
  return typeof content === "string" ? content : "";
}

export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const { config, agent, context, onLog } = ctx;

  const url = asString(config.url, DEFAULT_URL);
  const model = asString(config.model, DEFAULT_MODEL);
  const apiKeyEnv = asString(config.apiKeyEnv, DEFAULT_API_KEY_ENV);
  const systemPrompt = asString(config.systemPrompt, "");
  const timeoutSec = asNumber(config.timeoutSec, DEFAULT_TIMEOUT_SEC);

  // Bearer key — the Hermes API_SERVER_KEY, injected as a Render secret.
  const apiKey = asString(process.env[apiKeyEnv], "");
  if (!apiKey) {
    return {
      exitCode: null,
      signal: null,
      timedOut: false,
      errorCode: "config",
      errorMessage: "Hermes API key env not set",
    };
  }

  // User message: raw chat text threaded in by the host-side bridge-chat-prompt
  // helper, else the rendered chat markdown. With neither, this is a task wake (e.g. an
  // assigned ticket): use the task section the executor renders from the issue, so the
  // agent answers the ticket and the host posts the reply as an issue comment.
  const chatMessage =
    asString(context?.bridgeChatPrompt, "") || asString(context?.paperclipChatMarkdown, "");
  const userMessage = chatMessage || asString(context?.paperclipTaskMarkdown, "");
  if (!userMessage) {
    return {
      exitCode: null,
      signal: null,
      timedOut: false,
      errorCode: "input",
      errorMessage: "no user message in context",
    };
  }

  const messages = [
    ...(systemPrompt.trim() ? [{ role: "system", content: systemPrompt }] : []),
    { role: "user", content: userMessage },
  ];

  // Session continuity headers — companyId scopes the tenant; the per-conversation
  // id prefers the bridge taskKey's trailing sessionId, falling back to the agent id.
  // When the bridge carries an active sub-account, scope the long-term memory pool
  // to `companyId:subAccountId` (X-Hermes-Session-Key → mem0 user_id). Hermes passes
  // this value through verbatim, so no Hermes-side change is needed. Absent a
  // sub-account the key is `companyId:_business` — a DISTINCT business/oversight
  // namespace that is a sibling of each sub-account, not a superset of them. The
  // companyId guard is preserved: without a company we emit no session key at all
  // (never a bare `:_business`).
  const companyId = asString(agent?.companyId, "");
  const subAccountId = asString(context?.bridgeSubAccountId, "");
  const sessionKey = companyId ? `${companyId}:${subAccountId || "_business"}` : "";
  // Audit stamp (Orbit Guard 6): make the memory-pool scope greppable so a
  // cross-sub-account mixup is detectable in the logs. Logs the resolved
  // sub-account ("_business" when absent) and the composed key verbatim.
  logger.info(
    {
      runId: ctx.runId,
      companyId: companyId || null,
      subAccountId: companyId ? subAccountId || "_business" : null,
      hermesSessionKey: sessionKey || null,
    },
    "hermes_openai: composed Hermes session key (memory pool scope)",
  );
  const taskKey = asString(context?.taskKey, "");
  const sessionId = parseSessionIdFromTaskKey(taskKey) || asString(agent?.id, "");
  // #20 (thread isolation): scope the Hermes thread-continuity id to the active
  // sub-account so a scope change (sub-account switch, or sub-account↔business)
  // starts a FRESH thread with no prior-scope turns carried in-context; same-scope
  // turns keep the same id and resume normally. Without this the id can collapse
  // to a constant per agent (the `|| agent.id` fallback) and thread across scopes.
  // Only scoped when we have a tenant, mirroring the session-key guard above.
  // `sessionParams.sessionId` (returned below) stays the RAW id on purpose — it
  // drives Conductor's own task-session bookkeeping, which is already
  // conversation-scoped, and the composed header is recomputed per request so the
  // two layers never need to agree.
  const scopedSessionId =
    companyId && sessionId ? `${sessionId}:${subAccountId || "_business"}` : sessionId;

  // Tenant-scope headers. Hermes echoes these back into the hidden
  // `_paperclip_context` envelope it injects into every MCP plugin-tool call, and
  // the Paperclip MCP server builds the tool `runContext` from that envelope
  // instead of from its own environment. These headers are therefore the ONLY
  // source of tenant identity for MCP-native tool calls — emit them per request,
  // never from module state, so concurrent runs for different tenants can never
  // share a scope.
  const agentId = asString(agent?.id, "");
  const runId = asString(ctx.runId, "");
  const projectId = asString(context?.projectId, "").trim();

  const headers: Record<string, string> = {
    "content-type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
  if (sessionKey) headers["X-Hermes-Session-Key"] = sessionKey;
  if (scopedSessionId) headers["X-Hermes-Session-Id"] = scopedSessionId;
  if (runId) headers["X-Hermes-Run-Id"] = runId;
  if (agentId) headers["X-Hermes-Agent-Id"] = agentId;
  // companyId is sent as its own header, not left to be re-parsed out of
  // X-Hermes-Session-Key: that key is a memory-pool NAME (`company:sub|_business`)
  // and is lossy as an identity source — a sub-account literally named `_business`
  // is indistinguishable from business scope in it. The MCP server treats a
  // missing envelope companyId as fail-closed, so this header is what makes any
  // plugin-tool call possible at all.
  if (companyId) headers["X-Hermes-Company-Id"] = companyId;
  // Optional: sent ONLY when the run is scoped to a real sub-account. Its ABSENCE
  // is what means business/oversight scope — we deliberately never send the
  // `_business` sentinel here, because downstream (`extractPaperclipRunContext`
  // → `runCtx.subAccountId` → the WorkPipe plugin) an absent value becomes null
  // and fails sub-account-scoped tools closed, whereas a sentinel string would be
  // mistaken for an id.
  const scopedSubAccountId = subAccountId.trim();
  if (scopedSubAccountId) headers["X-Hermes-Sub-Account-Id"] = scopedSubAccountId;
  // Optional: company-scoped chat runs carry no project.
  if (projectId) headers["X-Hermes-Project-Id"] = projectId;

  const body = JSON.stringify({ model, messages, stream: false });

  const dispatcher = getProxyDispatcher();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutSec * 1000);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
      // undici-backed fetch routes through this dispatcher when a proxy is set.
      ...(dispatcher ? { dispatcher } : {}),
    } as RequestInit);

    if (!res.ok) {
      const errorMessage =
        res.status === 401
          ? "Hermes auth failed (401)"
          : `Hermes request failed (${res.status})`;
      return {
        exitCode: null,
        signal: null,
        timedOut: false,
        errorCode: `http_${res.status}`,
        errorMessage,
      };
    }

    const data = (await res.json()) as unknown;
    const content = extractAssistantContent(data);

    // Lift any ```ticket handoff block out of the reply BEFORE broadcasting, so
    // the raw JSON never reaches the user (HTTP response or future SSE). The
    // parsed ticket rides resultJson; the Manager (heartbeat post-run hook) files
    // it as an issue assigned to the CEO. This adapter is a transport sandbox and
    // cannot reach the issue service itself — hence the resultJson handoff.
    // Only chat replies can hand a ticket off. A reply to a ticket stays plain text: handed-off
    // tickets are assigned to the CEO, so a CEO answering its own ticket could file another.
    const { cleanedText, ticket } = chatMessage
      ? extractHandoffTicket(content)
      : { cleanedText: content, ticket: null };

    // Emit in the shape the Orbit bridge's StreamJsonParser maps to result_text,
    // which becomes the /chat response. Do not invent another format.
    await onLog("stdout", JSON.stringify({ type: "result", result: cleanedText }) + "\n");

    return {
      exitCode: 0,
      signal: null,
      timedOut: false,
      summary: cleanedText,
      // Report a session so the heartbeat PERSISTS the agent_task_sessions row
      // instead of garbage-collecting it post-run (heartbeat.ts:5785 clears the
      // row when params+displayId are both empty). This adapter is "stateless"
      // toward Conductor but DOES carry conversation continuity in Hermes via
      // X-Hermes-Session-Id; without this, the bridge's session is wiped after
      // turn 1 and every follow-up fails with "Session not found".
      sessionParams: { sessionId },
      ...(ticket ? { resultJson: { handoffTicket: ticket } } : {}),
    };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return {
        exitCode: null,
        signal: null,
        timedOut: true,
        errorCode: "timeout",
        errorMessage: `Hermes request timed out after ${timeoutSec}s`,
      };
    }
    const reason = err instanceof Error ? err.message : String(err);
    return {
      exitCode: null,
      signal: null,
      timedOut: false,
      errorCode: "network",
      errorMessage: `Hermes request error: ${reason}`,
    };
  } finally {
    clearTimeout(timer);
  }
}
