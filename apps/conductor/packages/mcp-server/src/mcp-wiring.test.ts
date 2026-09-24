import { describe, expect, it, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { PaperclipApiClient, type PluginToolDescriptor } from "./client.js";
import { registerPluginTools } from "./index.js";
import { PAPERCLIP_CONTEXT_ARG, PAPERCLIP_CONTEXT_ERROR } from "./plugin-tools.js";

/**
 * These tests drive a REAL McpServer + Client over the SDK's in-memory transport
 * rather than calling the tool definitions directly.
 *
 * That is the point: the security properties in plugin-tools.ts only hold if the
 * MCP SDK hands the handler the hidden `_paperclip_context` envelope. The SDK
 * parses arguments against the registered schema before invoking the callback,
 * so a registration path that rebuilt a plain `z.object()` from the raw shape
 * would silently strip the envelope and turn every call into a fail-closed
 * error. Only an end-to-end call through the SDK can catch that regression.
 */

const TOOL_NAME = "plugin_orbit_workpipe-tools_findContact";

const descriptor: PluginToolDescriptor = {
  name: "orbit.workpipe-tools:findContact",
  displayName: "WorkPipe Find Contact",
  description: "Search contacts in the active run's sub-account.",
  parametersSchema: {
    type: "object",
    properties: { query: { type: "string" } },
    required: ["query"],
  },
  pluginId: "orbit.workpipe-tools",
};

const ENVELOPE = {
  companyId: "11111111-1111-4111-8111-111111111111",
  subAccountId: "22222222-2222-4222-8222-222222222222",
  agentId: "33333333-3333-4333-8333-333333333333",
  runId: "44444444-4444-4444-8444-444444444444",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Serves the discovery route from `descriptor`; everything else is the execute route. */
function makeFetchMock() {
  return vi.fn(async (url: string, _init?: RequestInit) =>
    String(url).endsWith("/plugins/tools")
      ? jsonResponse([descriptor])
      : jsonResponse({ content: "Found 1 contact." }),
  );
}

function executeCalls(fetchMock: ReturnType<typeof makeFetchMock>) {
  return fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/plugins/tools/execute"));
}

async function connectServer(fetchMock: ReturnType<typeof makeFetchMock>): Promise<Client> {
  vi.stubGlobal("fetch", fetchMock);
  const server = new McpServer({ name: "paperclip", version: "0.1.0" });
  // Env-derived tenant ids are deliberately populated and deliberately wrong for
  // the call below — nothing may fall back to them.
  const apiClient = new PaperclipApiClient({
    apiUrl: "http://localhost:3100/api",
    apiKey: "token-123",
    companyId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    agentId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
    runId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  });
  await registerPluginTools(server, apiClient);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "wiring-test", version: "1.0.0" });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return client;
}

describe("MCP server plugin-tool wiring", () => {
  it("advertises discovered plugin tools without the context envelope", async () => {
    const client = await connectServer(makeFetchMock());

    const listed = await client.listTools();
    const tool = listed.tools.find((entry) => entry.name === TOOL_NAME);
    expect(tool).toBeDefined();
    expect(tool!.description).toBe(descriptor.description);
    // The envelope must never be advertised as a model-supplied parameter.
    const properties = (tool!.inputSchema as { properties?: Record<string, unknown> }).properties ?? {};
    expect(Object.keys(properties)).toEqual(["query"]);
    expect(PAPERCLIP_CONTEXT_ARG in properties).toBe(false);
  });

  it("carries the envelope tenant — including subAccountId — into the execute request", async () => {
    const fetchMock = makeFetchMock();
    const client = await connectServer(fetchMock);

    const result = await client.callTool({
      name: TOOL_NAME,
      arguments: { query: "ada", [PAPERCLIP_CONTEXT_ARG]: ENVELOPE },
    });

    const calls = executeCalls(fetchMock);
    expect(calls).toHaveLength(1);
    const body = JSON.parse(String((calls[0]![1] as RequestInit).body));
    expect(body.runContext).toEqual(ENVELOPE);
    expect(body.runContext.subAccountId).toBe(ENVELOPE.subAccountId);
    // Stripped before dispatch: the plugin tool sees model-visible params only.
    expect(body.parameters).toEqual({ query: "ada" });
    expect(JSON.stringify(result)).toContain("Found 1 contact.");
  });

  it("forwards a null subAccountId for business-scoped runs instead of dropping the field", async () => {
    const fetchMock = makeFetchMock();
    const client = await connectServer(fetchMock);

    await client.callTool({
      name: TOOL_NAME,
      arguments: {
        query: "ada",
        [PAPERCLIP_CONTEXT_ARG]: { ...ENVELOPE, subAccountId: null },
      },
    });

    const body = JSON.parse(String((executeCalls(fetchMock)[0]![1] as RequestInit).body));
    expect(body.runContext.subAccountId).toBeNull();
    expect("subAccountId" in body.runContext).toBe(true);
  });

  it("fails closed through the real SDK call path when the envelope is absent", async () => {
    const fetchMock = makeFetchMock();
    const client = await connectServer(fetchMock);

    const result = await client.callTool({ name: TOOL_NAME, arguments: { query: "ada" } });

    expect(JSON.stringify(result)).toContain(PAPERCLIP_CONTEXT_ERROR);
    expect(executeCalls(fetchMock)).toHaveLength(0);
  });
});
