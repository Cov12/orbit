import type { PaperclipMcpConfig } from "./config.js";

export class PaperclipApiError extends Error {
  readonly status: number;
  readonly method: string;
  readonly path: string;
  readonly body: unknown;

  constructor(input: {
    status: number;
    method: string;
    path: string;
    body: unknown;
    message: string;
  }) {
    super(input.message);
    this.name = "PaperclipApiError";
    this.status = input.status;
    this.method = input.method;
    this.path = input.path;
    this.body = input.body;
  }
}

export interface JsonRequestOptions {
  body?: unknown;
  includeRunId?: boolean;
  /**
   * Extra request headers. Values set here win over the defaults, which lets a
   * caller that already knows the authoritative run id (e.g. the plugin-tool
   * path, which reads it from the per-request `_paperclip_context` envelope)
   * send that id instead of the process-wide `PAPERCLIP_RUN_ID`.
   */
  headers?: Record<string, string>;
}

/** One plugin-contributed tool as returned by `GET /api/plugins/tools`. */
export interface PluginToolDescriptor {
  /** Fully namespaced tool name, e.g. `"orbit.workpipe-tools:listPipelines"`. */
  name: string;
  displayName: string;
  description: string;
  /** JSON Schema for the tool's model-visible parameters. */
  parametersSchema: Record<string, unknown>;
  pluginId: string;
}

/**
 * Tenant scope for one plugin-tool call.
 *
 * Every field is supplied per request by the caller. There is deliberately no
 * constructor, default, or env fallback for this type: a plugin tool must run
 * under the tenant that the current request identifies, never under whatever
 * tenant this MCP server process happens to be configured with.
 */
export interface PluginToolRunContext {
  companyId: string;
  agentId: string;
  runId: string;
  /** `null` means business/oversight scope, NOT "any sub-account". */
  subAccountId: string | null;
  projectId?: string;
}

function isWriteMethod(method: string): boolean {
  return !["GET", "HEAD"].includes(method.toUpperCase());
}

function buildErrorMessage(method: string, path: string, status: number, body: unknown): string {
  if (body && typeof body === "object" && "error" in body && typeof body.error === "string") {
    return `${method} ${path} failed with ${status}: ${body.error}`;
  }
  return `${method} ${path} failed with ${status}`;
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export class PaperclipApiClient {
  constructor(private readonly config: PaperclipMcpConfig) {}

  get defaults() {
    return {
      companyId: this.config.companyId,
      agentId: this.config.agentId,
      runId: this.config.runId,
    };
  }

  resolveCompanyId(companyId?: string | null): string {
    const resolved = companyId?.trim() || this.config.companyId;
    if (!resolved) {
      throw new Error("companyId is required because PAPERCLIP_COMPANY_ID is not set");
    }
    return resolved;
  }

  resolveAgentId(agentId?: string | null): string {
    const resolved = agentId?.trim() || this.config.agentId;
    if (!resolved) {
      throw new Error("agentId is required because PAPERCLIP_AGENT_ID is not set");
    }
    return resolved;
  }

  async requestJson<T>(method: string, path: string, options: JsonRequestOptions = {}): Promise<T> {
    if (!path.startsWith("/")) {
      throw new Error(`API path must start with "/": ${path}`);
    }

    const url = new URL(path.slice(1), `${this.config.apiUrl}/`);
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.config.apiKey}`,
      Accept: "application/json",
    };
    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }
    if ((options.includeRunId ?? isWriteMethod(method)) && this.config.runId) {
      headers["X-Paperclip-Run-Id"] = this.config.runId;
    }
    Object.assign(headers, options.headers ?? {});

    const response = await fetch(url, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const parsedBody = await parseResponseBody(response);

    if (!response.ok) {
      throw new PaperclipApiError({
        status: response.status,
        method: method.toUpperCase(),
        path,
        body: parsedBody,
        message: buildErrorMessage(method.toUpperCase(), path, response.status, parsedBody),
      });
    }

    return parsedBody as T;
  }

  /** List the plugin-contributed tools this instance exposes to agents. */
  async listPluginTools(): Promise<PluginToolDescriptor[]> {
    const body = await this.requestJson<unknown>("GET", "/plugins/tools");
    if (!Array.isArray(body)) return [];
    return body.filter((entry): entry is PluginToolDescriptor => {
      if (!entry || typeof entry !== "object") return false;
      const candidate = entry as Partial<PluginToolDescriptor>;
      return typeof candidate.name === "string" && candidate.name.length > 0;
    });
  }

  /**
   * Execute one plugin tool.
   *
   * `runContext` is a required parameter with no defaulting: this method must
   * never substitute `PAPERCLIP_COMPANY_ID` / `PAPERCLIP_AGENT_ID` /
   * `PAPERCLIP_RUN_ID` for a caller-supplied scope. The run id header is taken
   * from `runContext` too, so header and body always describe the same run.
   */
  async executePluginTool(input: {
    tool: string;
    parameters: Record<string, unknown>;
    runContext: PluginToolRunContext;
  }): Promise<unknown> {
    return this.requestJson<unknown>("POST", "/plugins/tools/execute", {
      body: {
        tool: input.tool,
        parameters: input.parameters,
        runContext: input.runContext,
      },
      includeRunId: false,
      headers: { "X-Paperclip-Run-Id": input.runContext.runId },
    });
  }
}
