import { createHmac } from "node:crypto";
import {
  definePlugin,
  type PluginConfigValidationResult,
  type PluginContext,
  type ToolResult,
  type ToolRunContext,
} from "@paperclipai/plugin-sdk";
import manifest from "./manifest.js";

type WorkpipeToolsConfig = {
  jwtSecretRef?: string;
  portalOrgId?: string;
  role?: string;
  userId?: string;
  workpipeBaseUrl?: string;
};

type ContactSearchParams = {
  query?: string;
  limit?: number;
  offset?: number;
};

type IdParams = {
  id?: string;
};

const PLUGIN_ID = "orbit.workpipe-tools";
// workpipe.orbit.example is currently parked; the live public deployment for this integration
// is the Render host below (also mirrored by WorkPipe's own middleware fallback).
const WORKPIPE_BASE_URL = "https://workpipe.orbit.example";
const TOKEN_TTL_SECONDS = 300;
const DEFAULT_ROLE = "member";
const DEFAULT_USER_ID = PLUGIN_ID;
const MAX_CONTACT_PAGE_SIZE = 200;
const MAX_CONTACT_SCAN_PAGES = 25;

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getOptionalNumber(value: unknown, fallback: number): number {
  const numeric = typeof value === "number" ? value : Number(value ?? fallback);
  if (!Number.isFinite(numeric)) return fallback;
  return numeric;
}

function toBase64Url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function mintToken(secret: string, claims: { orgId: string; userId: string; role: string }): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    org_id: claims.orgId,
    user_id: claims.userId,
    sub: claims.userId,
    role: claims.role,
    iat: now,
    exp: now + TOKEN_TTL_SECONDS,
  };
  const encodedHeader = toBase64Url(JSON.stringify(header));
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = createHmac("sha256", secret).update(signingInput).digest();
  return `${signingInput}.${toBase64Url(signature)}`;
}

async function getConfig(ctx: PluginContext): Promise<Required<WorkpipeToolsConfig>> {
  const raw = await ctx.config.get() as WorkpipeToolsConfig;
  return {
    jwtSecretRef: asNonEmptyString(raw.jwtSecretRef) ?? "",
    portalOrgId: asNonEmptyString(raw.portalOrgId) ?? "",
    role: asNonEmptyString(raw.role) ?? DEFAULT_ROLE,
    userId: asNonEmptyString(raw.userId) ?? DEFAULT_USER_ID,
    workpipeBaseUrl: asNonEmptyString(raw.workpipeBaseUrl) ?? WORKPIPE_BASE_URL,
  };
}

/**
 * Resolve the per-call WorkPipe runtime (minted token + endpoint).
 *
 * `runCtx.portalOrgId` — the value the HOST resolves per company from
 * `plugin_company_settings` — is the ONLY accepted source for the org the token
 * is minted for. The `runCtx` is threaded in per call the same way
 * `subAccountId` already is.
 *
 * This is fail-closed: there is no fallback to the instance-wide
 * `config.portalOrgId`. A company without a per-company row gets no token at
 * all rather than silently borrowing whichever org the instance was configured
 * with — that fallback was a cross-tenant leak.
 */
async function resolveRuntime(ctx: PluginContext, runCtx?: ToolRunContext): Promise<{
  token: string;
  orgId: string;
  role: string;
  userId: string;
  baseUrl: string;
}> {
  const config = await getConfig(ctx);
  const secret = config.jwtSecretRef ? await ctx.secrets.resolve(config.jwtSecretRef) : "";
  const trimmedSecret = secret.trim();
  if (!trimmedSecret) {
    throw new Error("Plugin is misconfigured: jwtSecretRef resolved to an empty value");
  }
  const orgId = asNonEmptyString(runCtx?.portalOrgId);
  if (!orgId) {
    throw new Error("Active run is not scoped to a WorkPipe organization");
  }
  return {
    token: mintToken(trimmedSecret, {
      orgId,
      userId: config.userId,
      role: config.role,
    }),
    orgId,
    role: config.role,
    userId: config.userId,
    baseUrl: config.workpipeBaseUrl,
  };
}

/**
 * Resolve the sub-account these tools are scoped to.
 *
 * `runCtx.subAccountId` is the only accepted source. The host supplies it per
 * call from the run's own scope, so it is already tenant-pinned by the time it
 * reaches the plugin.
 *
 * A `null`/absent value means the run is business/oversight scoped rather than
 * sub-account scoped. That is an explicit failure for these tools, not a
 * wildcard over every sub-account.
 */
function resolveSubAccountId(runCtx: ToolRunContext): string {
  const subAccountId = asNonEmptyString(runCtx.subAccountId);
  if (!subAccountId) {
    throw new Error("Active run is not scoped to a sub-account");
  }
  return subAccountId;
}

async function fetchInternalJson(
  ctx: PluginContext,
  runtime: { token: string; baseUrl: string },
  path: string,
  params?: Record<string, string>,
): Promise<unknown> {
  const url = new URL(`/api/internal${path}`, runtime.baseUrl);
  for (const [key, value] of Object.entries(params ?? {})) {
    url.searchParams.set(key, value);
  }
  const response = await ctx.http.fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${runtime.token}`,
      Accept: "application/json",
    },
  });
  const bodyText = await response.text();
  let parsed: unknown = null;
  if (bodyText) {
    try {
      parsed = JSON.parse(bodyText) as unknown;
    } catch {
      throw new Error(`WorkPipe returned invalid JSON (${response.status} ${response.statusText})`);
    }
  }
  if (!response.ok) {
    const detail = parsed && typeof parsed === "object"
      ? asNonEmptyString((parsed as Record<string, unknown>).error)
        ?? asNonEmptyString((parsed as Record<string, unknown>).detail)
        ?? bodyText
      : bodyText;
    throw new Error(`WorkPipe API error ${response.status}: ${detail || response.statusText}`);
  }
  return parsed;
}

function ensureObject(payload: unknown, label: string): Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error(`WorkPipe returned an unexpected ${label} payload`);
  }
  return payload as Record<string, unknown>;
}

async function listPipelines(ctx: PluginContext, runCtx: ToolRunContext): Promise<ToolResult> {
  const runtime = await resolveRuntime(ctx, runCtx);
  const subAccountId = resolveSubAccountId(runCtx);
  const payload = ensureObject(
    await fetchInternalJson(ctx, runtime, "/pipelines", { subAccountId }),
    "pipelines",
  );
  const pipelines = Array.isArray(payload.pipelines) ? payload.pipelines : [];
  return {
    content: `Found ${pipelines.length} pipeline(s) for sub-account ${subAccountId}.`,
    data: {
      baseUrl: runtime.baseUrl,
      orgId: runtime.orgId,
      subAccountId,
      pipelines,
      count: pipelines.length,
    },
  };
}

async function getPipeline(ctx: PluginContext, params: IdParams, runCtx: ToolRunContext): Promise<ToolResult> {
  const pipelineId = asNonEmptyString(params.id);
  if (!pipelineId) {
    return { error: "id is required" };
  }
  const listed = await listPipelines(ctx, runCtx);
  const pipelines = Array.isArray(listed.data && (listed.data as Record<string, unknown>).pipelines)
    ? (listed.data as Record<string, unknown>).pipelines as Array<Record<string, unknown>>
    : [];
  const pipeline = pipelines.find((entry) => asNonEmptyString(entry.id) === pipelineId) ?? null;
  if (!pipeline) {
    return { error: `Pipeline ${pipelineId} was not found in the active sub-account` };
  }
  return {
    content: `Loaded pipeline ${pipelineId}.`,
    data: {
      baseUrl: WORKPIPE_BASE_URL,
      ...(listed.data as Record<string, unknown>),
      pipeline,
    },
  };
}

async function findContact(
  ctx: PluginContext,
  params: ContactSearchParams,
  runCtx: ToolRunContext,
): Promise<ToolResult> {
  const query = asNonEmptyString(params.query);
  if (!query) {
    return { error: "query is required" };
  }
  const runtime = await resolveRuntime(ctx, runCtx);
  const subAccountId = resolveSubAccountId(runCtx);
  const limit = Math.max(1, Math.min(MAX_CONTACT_PAGE_SIZE, Math.floor(getOptionalNumber(params.limit, 10))));
  const offset = Math.max(0, Math.floor(getOptionalNumber(params.offset, 0)));
  const payload = ensureObject(
    await fetchInternalJson(ctx, runtime, "/contacts", {
      subAccountId,
      search: query,
      limit: String(limit),
      offset: String(offset),
    }),
    "contacts",
  );
  const contacts = Array.isArray(payload.contacts) ? payload.contacts : [];
  const totalRaw = payload.total;
  const total = typeof totalRaw === "number" ? totalRaw : contacts.length;
  return {
    content: `Found ${contacts.length} contact(s) matching “${query}” in sub-account ${subAccountId}.`,
    data: {
      baseUrl: runtime.baseUrl,
      orgId: runtime.orgId,
      subAccountId,
      query,
      total,
      contacts,
      limit,
      offset,
    },
  };
}

async function getContact(ctx: PluginContext, params: IdParams, runCtx: ToolRunContext): Promise<ToolResult> {
  const contactId = asNonEmptyString(params.id);
  if (!contactId) {
    return { error: "id is required" };
  }
  const runtime = await resolveRuntime(ctx, runCtx);
  const subAccountId = resolveSubAccountId(runCtx);
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;
  for (let page = 0; page < MAX_CONTACT_SCAN_PAGES && offset < total; page += 1) {
    const payload = ensureObject(
      await fetchInternalJson(ctx, runtime, "/contacts", {
        subAccountId,
        limit: String(MAX_CONTACT_PAGE_SIZE),
        offset: String(offset),
      }),
      "contacts",
    );
    const contacts = Array.isArray(payload.contacts)
      ? payload.contacts as Array<Record<string, unknown>>
      : [];
    const totalRaw = payload.total;
    total = typeof totalRaw === "number" ? totalRaw : contacts.length;
    const match = contacts.find((entry) => asNonEmptyString(entry.id) === contactId) ?? null;
    if (match) {
      return {
        content: `Loaded contact ${contactId}.`,
        data: {
          baseUrl: runtime.baseUrl,
          orgId: runtime.orgId,
          subAccountId,
          contact: match,
        },
      };
    }
    if (contacts.length < MAX_CONTACT_PAGE_SIZE) break;
    offset += MAX_CONTACT_PAGE_SIZE;
  }
  return { error: `Contact ${contactId} was not found in the active sub-account` };
}

async function registerToolHandlers(ctx: PluginContext): Promise<void> {
  // Handlers keyed by manifest tool name. Registration is DRIVEN by
  // manifest.tools below, so a registered name (and its schema) can never drift
  // from the manifest name the dispatcher routes by — the failure mode that
  // made every execute 500 with `No tool handler registered`.
  const handlers: Record<
    string,
    (params: unknown, runCtx: ToolRunContext) => Promise<ToolResult>
  > = {
    listPipelines: (_params, runCtx) => listPipelines(ctx, runCtx),
    getPipeline: (params, runCtx) => getPipeline(ctx, params as IdParams, runCtx),
    findContact: (params, runCtx) => findContact(ctx, params as ContactSearchParams, runCtx),
    getContact: (params, runCtx) => getContact(ctx, params as IdParams, runCtx),
  };

  for (const tool of manifest.tools ?? []) {
    const handler = handlers[tool.name];
    if (!handler) {
      throw new Error(`workpipe-tools: no handler registered for manifest tool "${tool.name}"`);
    }
    ctx.tools.register(
      tool.name,
      {
        displayName: tool.displayName ?? tool.name,
        description: tool.description ?? "",
        parametersSchema: tool.parametersSchema ?? { type: "object", properties: {} },
      },
      handler,
    );
  }
}

function validateConfigShape(config: Record<string, unknown>): PluginConfigValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!asNonEmptyString(config.jwtSecretRef)) {
    errors.push("jwtSecretRef is required");
  }
  if (!asNonEmptyString(config.portalOrgId)) {
    errors.push("portalOrgId is required because portal org mapping is not exposed on ctx.companies.get()");
  }
  const role = asNonEmptyString(config.role);
  if (role && role.length > 64) {
    errors.push("role must be 64 characters or fewer");
  }
  const userId = asNonEmptyString(config.userId);
  if (userId && userId.length > 255) {
    errors.push("userId must be 255 characters or fewer");
  }
  warnings.push(
    `Base URL defaults to ${WORKPIPE_BASE_URL}; override per-instance with the workpipeBaseUrl config field.`,
  );
  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}

const plugin = definePlugin({
  async setup(ctx) {
    await registerToolHandlers(ctx);
    ctx.logger.info("Orbit WorkPipe tools plugin ready", { baseUrl: WORKPIPE_BASE_URL });
  },

  async onHealth() {
    return {
      status: "ok",
      message: "Orbit WorkPipe tools plugin healthy",
      details: {
        baseUrl: WORKPIPE_BASE_URL,
        tools: (manifest.tools ?? []).map((tool) => tool.name),
      },
    };
  },

  async onValidateConfig(config) {
    return validateConfigShape(config as Record<string, unknown>);
  },
});

export default plugin;
