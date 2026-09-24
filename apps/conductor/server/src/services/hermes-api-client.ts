import { ProxyAgent } from "undici";
import { logger } from "../middleware/logger.js";

// ---------------------------------------------------------------------------
// Shared Hermes api_server client.
//
// The Hermes api_server lives on a private tailnet. The chat adapter
// (`adapters/hermes-openai/execute.ts`) already reaches it with a bearer key and a
// per-request undici ProxyAgent; the standalone bridge forwarders (Engram seed,
// role map) need the SAME transport but carry no agent context, so there is no
// `adapter_config.url` to read a URL from. Hence a base-URL env and this one helper
// — the ProxyAgent logic lives here and in the adapter only, never a third time.
// ---------------------------------------------------------------------------

/** Same tailnet host the assistant adapter talks to; the api_server surface is :8643. */
const DEFAULT_BASE_URL = "http://100.64.0.10:8643";
const DEFAULT_API_KEY_ENV = "HERMES_API_KEY";
const DEFAULT_TIMEOUT_SEC = 30;

/**
 * Cached undici ProxyAgent, mirroring the adapter's: built once per proxy URL rather
 * than per request, and never installed as the global dispatcher so only these fetches
 * are routed through it. `HERMES_OUTBOUND_PROXY` names the egress proxy (Render).
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

/** Base URL of the Hermes api_server. Read per request so a redeploy-free repoint works. */
export function hermesApiBaseUrl(): string {
  const raw = process.env.HERMES_API_BASE_URL?.trim();
  return (raw && raw.length > 0 ? raw : DEFAULT_BASE_URL).replace(/\/+$/, "");
}

/** Raised for anything that prevents us from getting a response at all. */
export class HermesApiError extends Error {
  readonly code: "config" | "timeout" | "network";

  constructor(code: "config" | "timeout" | "network", message: string) {
    super(message);
    this.name = "HermesApiError";
    this.code = code;
  }
}

export type HermesApiResult = {
  /** HTTP status Hermes replied with. */
  status: number;
  /** True for 2xx. Callers decide their own failure behavior (502 vs. fallback). */
  ok: boolean;
  /** Parsed JSON body, or null when the body was empty/unparseable. */
  body: unknown;
};

/**
 * Authed, proxy-dispatched POST to a Hermes api_server path (e.g. `/v1/memory/seed`).
 *
 * Returns the parsed JSON plus status for ANY HTTP reply, including non-2xx — a Hermes
 * 4xx/5xx is information the caller may want to relay. Throws `HermesApiError` only when
 * no reply was obtained: missing bearer key, timeout, or transport failure.
 */
export async function hermesApiPost(
  path: string,
  payload: unknown,
  opts: { timeoutSec?: number } = {},
): Promise<HermesApiResult> {
  // Bearer key — the Hermes API_SERVER_KEY, injected as a Render secret.
  const apiKey = process.env[DEFAULT_API_KEY_ENV]?.trim();
  if (!apiKey) {
    throw new HermesApiError("config", `${DEFAULT_API_KEY_ENV} is not set`);
  }

  const url = `${hermesApiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
  const timeoutSec = opts.timeoutSec ?? DEFAULT_TIMEOUT_SEC;
  const dispatcher = getProxyDispatcher();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutSec * 1000);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
      // undici-backed fetch routes through this dispatcher when a proxy is set.
      ...(dispatcher ? { dispatcher } : {}),
    } as RequestInit);

    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      // Empty or non-JSON body — surface the status alone rather than failing the call.
      body = null;
    }

    if (!res.ok) {
      logger.warn({ path, status: res.status }, "hermes-api-client: non-2xx from Hermes api_server");
    }
    return { status: res.status, ok: res.ok, body };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new HermesApiError("timeout", `Hermes request to ${path} timed out after ${timeoutSec}s`);
    }
    const reason = err instanceof Error ? err.message : String(err);
    throw new HermesApiError("network", `Hermes request to ${path} failed: ${reason}`);
  } finally {
    clearTimeout(timer);
  }
}
