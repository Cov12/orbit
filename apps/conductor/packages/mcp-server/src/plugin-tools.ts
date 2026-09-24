import { z } from "zod";
import type { PaperclipApiClient, PluginToolDescriptor, PluginToolRunContext } from "./client.js";
import { formatErrorResponse, formatTextResponse } from "./format.js";

/**
 * Hidden argument name that Hermes injects into every MCP plugin-tool call.
 *
 * This MCP server is the strict CONSUMER of that envelope:
 *  - it is the ONLY source of tenant identity for plugin-tool calls;
 *  - it is STRIPPED from the arguments before they reach the plugin tool, so the
 *    tool can never see (or be tricked into echoing) it as a normal parameter;
 *  - if it is missing or malformed the call FAILS CLOSED — no execute request is
 *    made, and there is deliberately no fallback to `PAPERCLIP_COMPANY_ID` /
 *    `PAPERCLIP_AGENT_ID` / `PAPERCLIP_RUN_ID`. Falling back to process env would
 *    run one tenant's tool call under whatever tenant this process was started
 *    with, which is exactly the cross-tenant failure this guard exists to stop.
 */
export const PAPERCLIP_CONTEXT_ARG = "_paperclip_context";

/** Verbatim fail-closed message. Do not reword — it is part of the locked contract. */
export const PAPERCLIP_CONTEXT_ERROR =
  "Paperclip context missing or invalid for plugin tool execution";

export type PaperclipContextExtraction =
  | { ok: true; runContext: PluginToolRunContext; toolArgs: Record<string, unknown> }
  | { ok: false; error: string };

function readRequiredId(source: Record<string, unknown>, key: string): string | null {
  const value = source[key];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Pull the tenant scope out of a plugin tool's incoming arguments.
 *
 * Takes ONLY the raw arguments — it has no access to the client, the config, or
 * `process.env`, so it is structurally incapable of an env fallback.
 *
 * Returns the validated `runContext` plus a copy of the arguments with the
 * envelope removed. Any problem returns `{ ok: false }`; callers must not
 * execute anything in that case.
 */
export function extractPaperclipRunContext(args: unknown): PaperclipContextExtraction {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    return { ok: false, error: PAPERCLIP_CONTEXT_ERROR };
  }

  const allArgs = args as Record<string, unknown>;
  const envelope = allArgs[PAPERCLIP_CONTEXT_ARG];
  if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)) {
    return { ok: false, error: PAPERCLIP_CONTEXT_ERROR };
  }

  const source = envelope as Record<string, unknown>;
  const companyId = readRequiredId(source, "companyId");
  const agentId = readRequiredId(source, "agentId");
  const runId = readRequiredId(source, "runId");
  if (!companyId || !agentId || !runId) {
    return { ok: false, error: PAPERCLIP_CONTEXT_ERROR };
  }

  // subAccountId is optional and may legitimately be null (business/oversight
  // scope). A blank string is normalised to null rather than treated as an id —
  // that narrows scope, never widens it. A non-string, non-null value is
  // malformed and fails the whole call closed.
  const rawSubAccountId = source.subAccountId;
  let subAccountId: string | null;
  if (rawSubAccountId === undefined || rawSubAccountId === null) {
    subAccountId = null;
  } else if (typeof rawSubAccountId === "string") {
    subAccountId = rawSubAccountId.trim() || null;
  } else {
    return { ok: false, error: PAPERCLIP_CONTEXT_ERROR };
  }

  // projectId is optional; company-scoped runs carry none. Present-but-not-a-
  // string is malformed, so fail closed rather than silently dropping it.
  const rawProjectId = source.projectId;
  let projectId: string | undefined;
  if (rawProjectId === undefined || rawProjectId === null) {
    projectId = undefined;
  } else if (typeof rawProjectId === "string") {
    projectId = rawProjectId.trim() || undefined;
  } else {
    return { ok: false, error: PAPERCLIP_CONTEXT_ERROR };
  }

  // Strip the envelope. The plugin tool receives model-visible parameters only.
  const toolArgs: Record<string, unknown> = { ...allArgs };
  delete toolArgs[PAPERCLIP_CONTEXT_ARG];

  return {
    ok: true,
    runContext: {
      companyId,
      agentId,
      runId,
      subAccountId,
      ...(projectId ? { projectId } : {}),
    },
    toolArgs,
  };
}

// ---------------------------------------------------------------------------
// Descriptor → MCP tool
// ---------------------------------------------------------------------------

/** MCP tool names are restricted to `[A-Za-z0-9_-]`; namespaced names are not. */
export function toMcpToolName(namespacedName: string): string {
  const sanitized = namespacedName.replace(/[^A-Za-z0-9_-]/g, "_").replace(/^_+/, "");
  return `plugin_${sanitized || "tool"}`;
}

function jsonSchemaToZod(schema: unknown): z.ZodTypeAny {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) return z.unknown();
  const node = schema as Record<string, unknown>;

  if (Array.isArray(node.enum) && node.enum.length > 0) {
    const literals = node.enum.filter(
      (value): value is string | number | boolean =>
        typeof value === "string" || typeof value === "number" || typeof value === "boolean",
    );
    if (literals.length === node.enum.length) {
      return z.union(
        literals.map((value) => z.literal(value)) as unknown as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]],
      );
    }
  }

  switch (node.type) {
    case "string":
      return z.string();
    case "number":
    case "integer":
      return z.number();
    case "boolean":
      return z.boolean();
    case "array":
      return z.array(jsonSchemaToZod(node.items));
    case "object":
      return z.object(jsonSchemaShapeToZod(node)).passthrough();
    default:
      return z.unknown();
  }
}

function jsonSchemaShapeToZod(schema: Record<string, unknown>): z.ZodRawShape {
  const properties =
    schema.properties && typeof schema.properties === "object" && !Array.isArray(schema.properties)
      ? (schema.properties as Record<string, unknown>)
      : {};
  const required = new Set(
    Array.isArray(schema.required)
      ? schema.required.filter((entry): entry is string => typeof entry === "string")
      : [],
  );

  const shape: z.ZodRawShape = {};
  for (const [key, propertySchema] of Object.entries(properties)) {
    // The envelope is never a declared parameter — it must not become one even
    // if a plugin's own schema happens to mention it.
    if (key === PAPERCLIP_CONTEXT_ARG) continue;
    const base = jsonSchemaToZod(propertySchema);
    const description =
      propertySchema && typeof propertySchema === "object" && !Array.isArray(propertySchema)
        ? (propertySchema as Record<string, unknown>).description
        : undefined;
    const described = typeof description === "string" ? base.describe(description) : base;
    shape[key] = required.has(key) ? described : described.optional();
  }
  return shape;
}

/**
 * Build the zod input schema advertised to the model.
 *
 * `.passthrough()` is load-bearing: the MCP SDK hands the tool callback the
 * PARSED arguments, and a plain `z.object()` silently drops unknown keys — which
 * would delete `_paperclip_context` before this server ever saw it, turning
 * every call into a fail-closed error. Passthrough keeps the envelope reachable
 * while leaving it out of the advertised, model-visible schema.
 */
export function buildPluginToolInputSchema(descriptor: PluginToolDescriptor): z.AnyZodObject {
  return z.object(jsonSchemaShapeToZod(descriptor.parametersSchema ?? {})).passthrough();
}

export interface PluginToolDefinition {
  /** MCP-safe tool name exposed to the model. */
  name: string;
  /** Fully namespaced Paperclip tool name used on the execute route. */
  namespacedName: string;
  description: string;
  inputSchema: z.AnyZodObject;
  execute: (input: unknown) => Promise<{ content: Array<{ type: "text"; text: string }> }>;
}

export function createPluginToolDefinition(
  client: PaperclipApiClient,
  descriptor: PluginToolDescriptor,
  name = toMcpToolName(descriptor.name),
): PluginToolDefinition {
  return {
    name,
    namespacedName: descriptor.name,
    description: descriptor.description || descriptor.displayName || descriptor.name,
    inputSchema: buildPluginToolInputSchema(descriptor),
    execute: async (input) => {
      const extracted = extractPaperclipRunContext(input);
      if (!extracted.ok) {
        // Fail closed: no execute request is issued at all.
        return formatTextResponse({ error: extracted.error });
      }
      try {
        return formatTextResponse(
          await client.executePluginTool({
            tool: descriptor.name,
            parameters: extracted.toolArgs,
            runContext: extracted.runContext,
          }),
        );
      } catch (error) {
        return formatErrorResponse(error);
      }
    },
  };
}

/**
 * Fetch every plugin tool and turn it into an MCP tool definition.
 *
 * Name collisions after sanitisation are disambiguated with a numeric suffix so
 * two plugins can never silently shadow one another.
 */
export async function createPluginToolDefinitions(
  client: PaperclipApiClient,
): Promise<PluginToolDefinition[]> {
  const descriptors = await client.listPluginTools();
  const used = new Set<string>();
  return descriptors.map((descriptor) => {
    let name = toMcpToolName(descriptor.name);
    if (used.has(name)) {
      let suffix = 2;
      while (used.has(`${name}_${suffix}`)) suffix += 1;
      name = `${name}_${suffix}`;
    }
    used.add(name);
    return createPluginToolDefinition(client, descriptor, name);
  });
}
