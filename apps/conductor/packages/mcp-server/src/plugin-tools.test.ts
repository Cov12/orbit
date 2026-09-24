import { beforeEach, describe, expect, it, vi } from "vitest";
import { PaperclipApiClient, type PluginToolDescriptor } from "./client.js";
import {
  PAPERCLIP_CONTEXT_ARG,
  PAPERCLIP_CONTEXT_ERROR,
  buildPluginToolInputSchema,
  createPluginToolDefinition,
  createPluginToolDefinitions,
  extractPaperclipRunContext,
} from "./plugin-tools.js";

const ENV_COMPANY = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const ENV_AGENT = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const ENV_RUN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function makeClient() {
  // Deliberately populated: these env-derived values must NEVER appear in a
  // plugin tool's runContext. Every assertion below that names them is checking
  // for the absence of an env fallback.
  return new PaperclipApiClient({
    apiUrl: "http://localhost:3100/api",
    apiKey: "token-123",
    companyId: ENV_COMPANY,
    agentId: ENV_AGENT,
    runId: ENV_RUN,
  });
}

const descriptor: PluginToolDescriptor = {
  name: "orbit.workpipe-tools:findContact",
  displayName: "WorkPipe Find Contact",
  description: "Search contacts in the active run's sub-account by name or email.",
  parametersSchema: {
    type: "object",
    properties: {
      query: { type: "string" },
      limit: { type: "number" },
    },
    required: ["query"],
  },
  pluginId: "orbit.workpipe-tools",
};

function envelope(overrides: Record<string, unknown> = {}) {
  return {
    companyId: "11111111-1111-4111-8111-111111111111",
    subAccountId: "22222222-2222-4222-8222-222222222222",
    agentId: "33333333-3333-4333-8333-333333333333",
    runId: "44444444-4444-4444-8444-444444444444",
    ...overrides,
  };
}

function mockJsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function lastRequestBody(fetchMock: ReturnType<typeof vi.fn>) {
  const [, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
  return JSON.parse(String(init.body));
}

describe("_paperclip_context extraction", () => {
  it("builds the runContext from the envelope and strips it from the tool args", () => {
    const result = extractPaperclipRunContext({
      query: "ada",
      limit: 5,
      [PAPERCLIP_CONTEXT_ARG]: envelope({ projectId: "55555555-5555-4555-8555-555555555555" }),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.runContext).toEqual({
      companyId: "11111111-1111-4111-8111-111111111111",
      subAccountId: "22222222-2222-4222-8222-222222222222",
      agentId: "33333333-3333-4333-8333-333333333333",
      runId: "44444444-4444-4444-8444-444444444444",
      projectId: "55555555-5555-4555-8555-555555555555",
    });
    expect(result.toolArgs).toEqual({ query: "ada", limit: 5 });
    expect(PAPERCLIP_CONTEXT_ARG in result.toolArgs).toBe(false);
  });

  it("omits projectId entirely for company-scoped runs", () => {
    const result = extractPaperclipRunContext({ [PAPERCLIP_CONTEXT_ARG]: envelope() });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect("projectId" in result.runContext).toBe(false);
  });

  it("keeps subAccountId null for business-scoped runs instead of dropping the field", () => {
    const result = extractPaperclipRunContext({
      [PAPERCLIP_CONTEXT_ARG]: envelope({ subAccountId: null }),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.runContext.subAccountId).toBeNull();
  });

  it("normalises a blank subAccountId to null rather than treating it as an id", () => {
    for (const blank of ["", "   "]) {
      const result = extractPaperclipRunContext({
        [PAPERCLIP_CONTEXT_ARG]: envelope({ subAccountId: blank }),
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.runContext.subAccountId).toBeNull();
    }
  });

  it("fails closed when the envelope is absent", () => {
    expect(extractPaperclipRunContext({ query: "ada" })).toEqual({
      ok: false,
      error: PAPERCLIP_CONTEXT_ERROR,
    });
  });

  it.each([
    ["missing companyId", { companyId: undefined }],
    ["missing agentId", { agentId: undefined }],
    ["missing runId", { runId: undefined }],
    ["empty companyId", { companyId: "" }],
    ["whitespace agentId", { agentId: "   " }],
    ["empty runId", { runId: "" }],
    ["non-string companyId", { companyId: 42 }],
    ["non-string runId", { runId: { id: "x" } }],
    ["malformed subAccountId", { subAccountId: 7 }],
    ["malformed projectId", { projectId: [] }],
  ])("fails closed on %s", (_label, overrides) => {
    const result = extractPaperclipRunContext({
      [PAPERCLIP_CONTEXT_ARG]: envelope(overrides),
    });
    expect(result).toEqual({ ok: false, error: PAPERCLIP_CONTEXT_ERROR });
  });

  it.each([
    ["null envelope", null],
    ["array envelope", []],
    ["string envelope", "companyId=1"],
  ])("fails closed on a %s", (_label, value) => {
    expect(extractPaperclipRunContext({ [PAPERCLIP_CONTEXT_ARG]: value })).toEqual({
      ok: false,
      error: PAPERCLIP_CONTEXT_ERROR,
    });
  });

  it.each([
    ["null args", null],
    ["array args", []],
    ["string args", "query=ada"],
  ])("fails closed on %s", (_label, value) => {
    expect(extractPaperclipRunContext(value)).toEqual({
      ok: false,
      error: PAPERCLIP_CONTEXT_ERROR,
    });
  });
});

describe("plugin tool execution", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("posts to the execute route with a runContext built from the envelope", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockJsonResponse({ content: "Found 1 contact." }));
    vi.stubGlobal("fetch", fetchMock);

    const tool = createPluginToolDefinition(makeClient(), descriptor);
    const response = await tool.execute({
      query: "ada",
      [PAPERCLIP_CONTEXT_ARG]: envelope(),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toBe("http://localhost:3100/api/plugins/tools/execute");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      tool: "orbit.workpipe-tools:findContact",
      parameters: { query: "ada" },
      runContext: {
        companyId: "11111111-1111-4111-8111-111111111111",
        subAccountId: "22222222-2222-4222-8222-222222222222",
        agentId: "33333333-3333-4333-8333-333333333333",
        runId: "44444444-4444-4444-8444-444444444444",
      },
    });
    expect(response.content[0]?.text).toContain("Found 1 contact.");
  });

  it("never forwards _paperclip_context to the plugin tool", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockJsonResponse({ content: "ok" }));
    vi.stubGlobal("fetch", fetchMock);

    const tool = createPluginToolDefinition(makeClient(), descriptor);
    await tool.execute({ query: "ada", [PAPERCLIP_CONTEXT_ARG]: envelope() });

    const body = lastRequestBody(fetchMock);
    expect(body.parameters).toEqual({ query: "ada" });
    expect(PAPERCLIP_CONTEXT_ARG in body.parameters).toBe(false);
  });

  it("fails closed without calling the execute route when the envelope is missing", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const tool = createPluginToolDefinition(makeClient(), descriptor);
    const response = await tool.execute({ query: "ada" });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(JSON.parse(response.content[0]!.text)).toEqual({ error: PAPERCLIP_CONTEXT_ERROR });
  });

  it("fails closed on an incomplete envelope instead of falling back to env tenant ids", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const tool = createPluginToolDefinition(makeClient(), descriptor);
    const response = await tool.execute({
      query: "ada",
      [PAPERCLIP_CONTEXT_ARG]: envelope({ companyId: "" }),
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(JSON.parse(response.content[0]!.text)).toEqual({ error: PAPERCLIP_CONTEXT_ERROR });
  });

  it("uses the envelope tenant, never PAPERCLIP_COMPANY_ID / AGENT_ID / RUN_ID", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockJsonResponse({ content: "ok" }));
    vi.stubGlobal("fetch", fetchMock);

    const tool = createPluginToolDefinition(makeClient(), descriptor);
    await tool.execute({ query: "ada", [PAPERCLIP_CONTEXT_ARG]: envelope() });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const serialized = String(init.body);
    for (const envValue of [ENV_COMPANY, ENV_AGENT, ENV_RUN]) {
      expect(serialized).not.toContain(envValue);
    }
    // The run-id header is taken from the envelope too, so header and body agree.
    expect((init.headers as Record<string, string>)["X-Paperclip-Run-Id"]).toBe(
      "44444444-4444-4444-8444-444444444444",
    );
  });

  it("isolates two tenants calling the same tool concurrently", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockJsonResponse({ content: "ok" }));
    vi.stubGlobal("fetch", fetchMock);

    // One shared client and one shared tool definition — exactly the setup that
    // would leak if any tenant state were cached on the module or the client.
    const tool = createPluginToolDefinition(makeClient(), descriptor);

    const tenantA = envelope({
      companyId: "aaaa1111-1111-4111-8111-111111111111",
      subAccountId: "aaaa2222-2222-4222-8222-222222222222",
      agentId: "aaaa3333-3333-4333-8333-333333333333",
      runId: "aaaa4444-4444-4444-8444-444444444444",
    });
    const tenantB = envelope({
      companyId: "bbbb1111-1111-4111-8111-111111111111",
      subAccountId: null,
      agentId: "bbbb3333-3333-4333-8333-333333333333",
      runId: "bbbb4444-4444-4444-8444-444444444444",
      projectId: "bbbb5555-5555-4555-8555-555555555555",
    });

    await Promise.all([
      tool.execute({ query: "a", [PAPERCLIP_CONTEXT_ARG]: tenantA }),
      tool.execute({ query: "b", [PAPERCLIP_CONTEXT_ARG]: tenantB }),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const bodies = fetchMock.mock.calls.map(([, init]) => JSON.parse(String((init as RequestInit).body)));
    const byQuery = new Map(bodies.map((body) => [body.parameters.query, body.runContext]));

    expect(byQuery.get("a")).toEqual({
      companyId: "aaaa1111-1111-4111-8111-111111111111",
      subAccountId: "aaaa2222-2222-4222-8222-222222222222",
      agentId: "aaaa3333-3333-4333-8333-333333333333",
      runId: "aaaa4444-4444-4444-8444-444444444444",
    });
    expect(byQuery.get("b")).toEqual({
      companyId: "bbbb1111-1111-4111-8111-111111111111",
      subAccountId: null,
      agentId: "bbbb3333-3333-4333-8333-333333333333",
      runId: "bbbb4444-4444-4444-8444-444444444444",
      projectId: "bbbb5555-5555-4555-8555-555555555555",
    });
  });

  it("reports execute-route errors instead of throwing", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockJsonResponse({ error: "Tool not found" }, 404));
    vi.stubGlobal("fetch", fetchMock);

    const tool = createPluginToolDefinition(makeClient(), descriptor);
    const response = await tool.execute({ query: "ada", [PAPERCLIP_CONTEXT_ARG]: envelope() });

    expect(JSON.parse(response.content[0]!.text)).toMatchObject({ status: 404 });
  });
});

describe("plugin tool discovery", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("registers one MCP tool per descriptor from GET /plugins/tools", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockJsonResponse([
        descriptor,
        { ...descriptor, name: "orbit.workpipe-tools:listPipelines", displayName: "List Pipelines" },
      ]),
    );
    vi.stubGlobal("fetch", fetchMock);

    const tools = await createPluginToolDefinitions(makeClient());

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toBe("http://localhost:3100/api/plugins/tools");
    expect(init.method).toBe("GET");
    expect(tools.map((tool) => tool.name)).toEqual([
      "plugin_orbit_workpipe-tools_findContact",
      "plugin_orbit_workpipe-tools_listPipelines",
    ]);
    expect(tools.map((tool) => tool.namespacedName)).toEqual([
      "orbit.workpipe-tools:findContact",
      "orbit.workpipe-tools:listPipelines",
    ]);
    expect(tools[0]!.description).toBe(descriptor.description);
  });

  it("disambiguates names that collide after sanitisation", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockJsonResponse([
        { ...descriptor, name: "a.b:c" },
        { ...descriptor, name: "a:b:c" },
      ]),
    );
    vi.stubGlobal("fetch", fetchMock);

    const tools = await createPluginToolDefinitions(makeClient());
    expect(tools.map((tool) => tool.name)).toEqual(["plugin_a_b_c", "plugin_a_b_c_2"]);
  });

  it("ignores malformed descriptors", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockJsonResponse([descriptor, null, { displayName: "no name" }, 5]),
    );
    vi.stubGlobal("fetch", fetchMock);

    const tools = await createPluginToolDefinitions(makeClient());
    expect(tools).toHaveLength(1);
  });
});

describe("advertised input schema", () => {
  it("mirrors the descriptor's JSON Schema and hides the context envelope", () => {
    const schema = buildPluginToolInputSchema(descriptor);
    expect(Object.keys(schema.shape).sort()).toEqual(["limit", "query"]);
    expect(PAPERCLIP_CONTEXT_ARG in schema.shape).toBe(false);

    expect(schema.parse({ query: "ada" })).toEqual({ query: "ada" });
    expect(() => schema.parse({})).toThrow();
    expect(() => schema.parse({ query: 1 })).toThrow();
  });

  it("passes the hidden envelope through parsing so the handler can read it", () => {
    // Without .passthrough() the MCP SDK would strip the envelope before the
    // tool callback ran, and every plugin-tool call would fail closed.
    const schema = buildPluginToolInputSchema(descriptor);
    const parsed = schema.parse({ query: "ada", [PAPERCLIP_CONTEXT_ARG]: envelope() });
    expect(parsed[PAPERCLIP_CONTEXT_ARG]).toEqual(envelope());
  });

  it("drops a declared _paperclip_context property so it can never be model-supplied", () => {
    const schema = buildPluginToolInputSchema({
      ...descriptor,
      parametersSchema: {
        type: "object",
        properties: { query: { type: "string" }, [PAPERCLIP_CONTEXT_ARG]: { type: "object" } },
        required: ["query", PAPERCLIP_CONTEXT_ARG],
      },
    });
    expect(Object.keys(schema.shape)).toEqual(["query"]);
  });
});
