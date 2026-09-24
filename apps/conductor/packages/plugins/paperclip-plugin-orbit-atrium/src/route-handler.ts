import { timingSafeEqual } from "node:crypto";
import type {
  PluginApiRequestInput,
  PluginApiResponse,
  PluginContext,
} from "@paperclipai/plugin-sdk";
import { StreamJsonParser, type ChatStreamEvent } from "./parse-stream-json.js";

export const SECRET_HEADER = "x-orbit-bridge-secret";

const DEFAULT_CHAT_RUN_TIMEOUT_MS = 120000;

/**
 * Maximum time to block on a synchronous (Option B) chat run before giving up.
 * Overridable via ORBIT_BRIDGE_RUN_TIMEOUT_MS; falls back to the default when the
 * env var is missing, non-numeric, or non-positive.
 */
const CHAT_RUN_TIMEOUT_MS = resolveRunTimeoutMs();

function resolveRunTimeoutMs(): number {
  const raw = process.env.ORBIT_BRIDGE_RUN_TIMEOUT_MS;
  if (typeof raw === "string") {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return DEFAULT_CHAT_RUN_TIMEOUT_MS;
}

class RunTimeoutError extends Error {}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new RunTimeoutError()), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

interface ChatRequestBody {
  companyId: string;
  agentId: string;
  prompt: string;
  sessionId?: string;
  reason?: string;
  /** Optional active sub-account; partitions the agent's long-term memory. */
  subAccountId?: string;
}

export type ChatChannelEvent =
  | ChatStreamEvent
  | { type: "status"; status: string; payload: Record<string, unknown> | null }
  | { type: "done"; runId: string }
  | { type: "error"; message: string; payload: Record<string, unknown> | null };

export interface ChatRouteSuccess {
  sessionId: string;
  channel: string;
  runId: string;
  created: boolean;
  /** Full accumulated assistant text once the run completes (Option B). */
  response: string;
}

/**
 * Outcome of relaying a single AgentSessionEvent. Lets the per-request handler
 * accumulate assistant text and settle the blocking promise without re-parsing
 * (re-pushing into the parser would corrupt its boundary buffer).
 */
type RelayOutcome =
  | { kind: "chunk"; events: ChatStreamEvent[] }
  | { kind: "status" }
  | { kind: "done"; runId: string; tail: ChatStreamEvent[] }
  | { kind: "error"; message: string }
  | { kind: "ignored" };

export async function handleChatRequest(
  ctx: PluginContext,
  input: PluginApiRequestInput,
): Promise<PluginApiResponse> {
  const config = await ctx.config.get();
  const expectedSecret = typeof config.sharedSecret === "string" ? config.sharedSecret : "";
  if (!expectedSecret) {
    return {
      status: 500,
      body: { error: "Plugin is misconfigured: sharedSecret is not set" },
    };
  }

  const providedSecret = readHeader(input.headers, SECRET_HEADER);
  if (!providedSecret || !secretsMatch(providedSecret, expectedSecret)) {
    return {
      status: 401,
      body: { error: "Invalid or missing X-Orbit-Bridge-Secret" },
    };
  }

  const body = validateBody(input.body);
  if ("error" in body) {
    return { status: 400, body: { error: body.error } };
  }

  if (body.companyId !== input.companyId) {
    return {
      status: 403,
      body: {
        error: "companyId mismatch between request scope and body",
      },
    };
  }

  let sessionId = body.sessionId;
  let created = false;
  if (!sessionId) {
    const session = await ctx.agents.sessions.create(body.agentId, body.companyId, {
      reason: body.reason ?? "orbit-atrium-chat",
    });
    sessionId = session.sessionId;
    created = true;
  }

  const channel = `chat-${sessionId}`;
  ctx.streams.open(channel, body.companyId);

  const parser = new StreamJsonParser();

  // Accumulate the parsed assistant text deltas so we can return the full
  // response body (Option B), while still relaying every event to the stream.
  const textBuffer: string[] = [];
  // The claude-code adapter emits a terminal `result` event carrying the
  // complete final answer; when present it is authoritative (last one wins),
  // and we fall back to the joined token stream only if it never arrives.
  let finalResultText: string | null = null;
  let settled = false;
  let resolveRun!: (text: string) => void;
  let rejectRun!: (err: Error) => void;
  const runComplete = new Promise<string>((resolve, reject) => {
    resolveRun = resolve;
    rejectRun = reject;
  });

  const onEvent = (event: import("@paperclipai/plugin-sdk").AgentSessionEvent): void => {
    const outcome = relayEvent(ctx, channel, parser, event);
    if (outcome.kind === "chunk") {
      for (const e of outcome.events) {
        if (e.type === "token") textBuffer.push(e.text);
        else if (e.type === "result_text") finalResultText = e.text;
      }
      return;
    }
    if (outcome.kind === "done") {
      for (const e of outcome.tail) {
        if (e.type === "token") textBuffer.push(e.text);
        else if (e.type === "result_text") finalResultText = e.text;
      }
      if (!settled) {
        settled = true;
        resolveRun(finalResultText ?? textBuffer.join(""));
      }
      return;
    }
    if (outcome.kind === "error") {
      if (!settled) {
        settled = true;
        rejectRun(new Error(outcome.message));
      }
    }
  };

  let runId: string;
  try {
    const send = await ctx.agents.sessions.sendMessage(sessionId, body.companyId, {
      prompt: body.prompt,
      reason: body.reason ?? "orbit-atrium-chat",
      subAccountId: body.subAccountId,
      onEvent,
    });
    runId = send.runId;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    ctx.logger.error("orbit-atrium: sendMessage failed", { sessionId, error: message });
    ctx.streams.emit(channel, {
      type: "error",
      message,
      payload: null,
    } satisfies ChatChannelEvent);
    ctx.streams.close(channel);
    return {
      status: 502,
      body: { error: "Agent session sendMessage failed", detail: message },
    };
  }

  // Block until the run completes (resolved on `done`, rejected on `error`),
  // bounded by CHAT_RUN_TIMEOUT_MS. The stream relay above is unaffected.
  let response: string;
  try {
    response = await withTimeout(runComplete, CHAT_RUN_TIMEOUT_MS);
  } catch (err) {
    if (err instanceof RunTimeoutError) {
      ctx.logger.error("orbit-atrium: chat run timed out", {
        sessionId,
        runId,
        timeoutMs: CHAT_RUN_TIMEOUT_MS,
      });
      ctx.streams.emit(channel, {
        type: "error",
        message: "Agent run timed out",
        payload: null,
      } satisfies ChatChannelEvent);
      ctx.streams.close(channel);
      return {
        status: 504,
        body: { error: "Agent run timed out", detail: `${CHAT_RUN_TIMEOUT_MS}ms` },
      };
    }
    // The run emitted an error event (channel already closed by relayEvent).
    const message = err instanceof Error ? err.message : String(err);
    ctx.logger.error("orbit-atrium: chat run failed", { sessionId, runId, error: message });
    return {
      status: 502,
      body: { error: "Agent run failed", detail: message },
    };
  }

  const result: ChatRouteSuccess = { sessionId, channel, runId, created, response };
  return { status: created ? 201 : 200, body: result };
}

function relayEvent(
  ctx: PluginContext,
  channel: string,
  parser: StreamJsonParser,
  event: import("@paperclipai/plugin-sdk").AgentSessionEvent,
): RelayOutcome {
  if (event.eventType === "chunk") {
    const events: ChatStreamEvent[] = [];
    if (typeof event.message === "string" && event.message.length > 0) {
      for (const chunk of parser.push(event.message)) {
        ctx.streams.emit(channel, chunk satisfies ChatChannelEvent);
        events.push(chunk);
      }
    }
    return { kind: "chunk", events };
  }
  if (event.eventType === "status") {
    ctx.streams.emit(channel, {
      type: "status",
      status: typeof event.message === "string" ? event.message : "unknown",
      payload: event.payload,
    } satisfies ChatChannelEvent);
    return { kind: "status" };
  }
  if (event.eventType === "done") {
    const tail: ChatStreamEvent[] = [];
    for (const chunk of parser.flush()) {
      ctx.streams.emit(channel, chunk satisfies ChatChannelEvent);
      tail.push(chunk);
    }
    ctx.streams.emit(channel, {
      type: "done",
      runId: event.runId,
    } satisfies ChatChannelEvent);
    ctx.streams.close(channel);
    return { kind: "done", runId: event.runId, tail };
  }
  if (event.eventType === "error") {
    const message = typeof event.message === "string" ? event.message : "agent session error";
    ctx.streams.emit(channel, {
      type: "error",
      message,
      payload: event.payload,
    } satisfies ChatChannelEvent);
    ctx.streams.close(channel);
    return { kind: "error", message };
  }
  return { kind: "ignored" };
}

export function readHeader(
  headers: Record<string, string>,
  name: string,
): string | null {
  const lower = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lower && typeof value === "string") return value;
  }
  return null;
}

export function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, "utf-8");
  const b = Buffer.from(expected, "utf-8");
  if (a.length !== b.length) {
    timingSafeEqual(a, a);
    return false;
  }
  return timingSafeEqual(a, b);
}

function validateBody(raw: unknown): ChatRequestBody | { error: string } {
  if (!raw || typeof raw !== "object") return { error: "request body must be a JSON object" };
  const r = raw as Record<string, unknown>;
  if (typeof r.companyId !== "string" || r.companyId.length === 0) {
    return { error: "companyId is required" };
  }
  if (typeof r.agentId !== "string" || r.agentId.length === 0) {
    return { error: "agentId is required" };
  }
  if (typeof r.prompt !== "string" || r.prompt.length === 0) {
    return { error: "prompt is required" };
  }
  const out: ChatRequestBody = {
    companyId: r.companyId,
    agentId: r.agentId,
    prompt: r.prompt,
  };
  if (typeof r.sessionId === "string" && r.sessionId.length > 0) out.sessionId = r.sessionId;
  if (typeof r.reason === "string" && r.reason.length > 0) out.reason = r.reason;
  if (typeof r.subAccountId === "string" && r.subAccountId.length > 0) out.subAccountId = r.subAccountId;
  return out;
}
