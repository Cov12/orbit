import type {
  AgentRunSummary,
  PluginApiRequestInput,
  PluginApiResponse,
  PluginContext,
} from "@paperclipai/plugin-sdk";
import { SECRET_HEADER, readHeader, secretsMatch } from "./route-handler.js";

/**
 * Request body for the read-only `history` verb. Atrium's dashboard POSTs a
 * `companyId` (re-checked against the plugin's resolved scope) plus an optional
 * `subAccountId`; the host filters runs server-side so a scoped read only ever
 * sees that sub-account's activity.
 */
interface HistoryRequestBody {
  companyId: string;
  /** Optional narrowing to a single agent's runs. */
  agentId?: string;
  /** Optional active sub-account; scopes the returned runs server-side. */
  subAccountId?: string;
  /** Max rows to return. Host clamps to a safe cap (default 20, max 50). */
  limit?: number;
}

export interface HistoryRouteSuccess {
  companyId: string;
  /** Echoes the requested scope; null means business-level (all runs). */
  subAccountId: string | null;
  /** Recent runs, newest first, already filtered by sub-account server-side. */
  runs: AgentRunSummary[];
}

/**
 * Handle the `history` verb: return a company's recent agent runs for the
 * Atrium dashboard. Mirrors the chat verb's shared-secret check and
 * companyId-scope re-check, then delegates to the sub-account-filtered
 * `ctx.agents.runs.list` host RPC.
 */
export async function handleHistoryRequest(
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
      body: { error: "companyId mismatch between request scope and body" },
    };
  }

  try {
    const runs = await ctx.agents.runs.list({
      companyId: body.companyId,
      agentId: body.agentId,
      limit: body.limit,
      subAccountId: body.subAccountId,
    });
    const result: HistoryRouteSuccess = {
      companyId: body.companyId,
      subAccountId: body.subAccountId ?? null,
      runs,
    };
    return { status: 200, body: result };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    ctx.logger.error("orbit-atrium: history list failed", {
      companyId: body.companyId,
      error: message,
    });
    return {
      status: 502,
      body: { error: "Failed to list agent runs", detail: message },
    };
  }
}

function validateBody(raw: unknown): HistoryRequestBody | { error: string } {
  if (!raw || typeof raw !== "object") return { error: "request body must be a JSON object" };
  const r = raw as Record<string, unknown>;
  if (typeof r.companyId !== "string" || r.companyId.length === 0) {
    return { error: "companyId is required" };
  }
  const out: HistoryRequestBody = { companyId: r.companyId };
  if (typeof r.agentId === "string" && r.agentId.length > 0) out.agentId = r.agentId;
  if (typeof r.subAccountId === "string" && r.subAccountId.length > 0) out.subAccountId = r.subAccountId;
  if (typeof r.limit === "number" && Number.isFinite(r.limit)) out.limit = r.limit;
  return out;
}
