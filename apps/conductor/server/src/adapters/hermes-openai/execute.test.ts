import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { execute } from "./execute.js";
import type { AdapterExecutionContext } from "../types.js";

// Spy on the audit logger without booting pino's transport worker thread.
const loggerInfoSpy = vi.hoisted(() => vi.fn());
vi.mock("../../middleware/logger.js", () => ({
  logger: { info: loggerInfoSpy, warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

function makeCtx(overrides: Partial<AdapterExecutionContext> = {}): AdapterExecutionContext {
  return {
    runId: "run-1",
    agent: {
      id: "agent-1",
      companyId: "company-1",
      name: "Agent",
      adapterType: "hermes_openai",
      adapterConfig: {},
    },
    runtime: {
      sessionId: null,
      sessionParams: null,
      sessionDisplayId: null,
      taskKey: null,
    },
    config: {},
    context: { bridgeChatPrompt: "hello hermes" },
    onLog: async () => {},
    ...overrides,
  };
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.HERMES_API_KEY = "secret-key";
  delete process.env.HERMES_OUTBOUND_PROXY;
  loggerInfoSpy.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  process.env = { ...ORIGINAL_ENV };
});

describe("hermes_openai adapter execute", () => {
  it("builds the request and emits the assistant text as a result line", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(200, { choices: [{ message: { content: "hi there" } }] }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const onLog = vi.fn(async () => {});
    const result = await execute(
      makeCtx({
        config: { systemPrompt: "be nice" },
        context: {
          bridgeChatPrompt: "hello hermes",
          taskKey: "plugin:orbit-chat:session:abc-123",
        },
        onLog,
      }),
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(calledUrl).toBe("http://100.64.0.10:8642/v1/chat/completions");
    expect(init.method).toBe("POST");

    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer secret-key");
    expect(headers["X-Hermes-Session-Key"]).toBe("company-1:_business");
    // #20: thread id is scoped to the (business) sub-account, not the bare sessionId.
    expect(headers["X-Hermes-Session-Id"]).toBe("abc-123:_business");

    const body = JSON.parse(init.body as string);
    expect(body.model).toBe("hermes-agent");
    expect(body.stream).toBe(false);
    expect(body.tools).toBeUndefined();
    expect(body.messages).toEqual([
      { role: "system", content: "be nice" },
      { role: "user", content: "hello hermes" },
    ]);

    expect(onLog).toHaveBeenCalledTimes(1);
    const [stream, chunk] = onLog.mock.calls[0] as unknown as [string, string];
    expect(stream).toBe("stdout");
    expect(JSON.parse(chunk)).toEqual({ type: "result", result: "hi there" });
    expect(chunk.endsWith("\n")).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.timedOut).toBe(false);
    expect(result.summary).toBe("hi there");
    expect(result.sessionParams).toEqual({ sessionId: "abc-123" });
  });

  it("scopes the memory key to companyId:subAccountId when the bridge carries a sub-account", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(200, { choices: [{ message: { content: "ok" } }] }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await execute(
      makeCtx({
        context: {
          bridgeChatPrompt: "hi",
          bridgeSubAccountId: "sub-9",
          taskKey: "plugin:orbit-chat:session:abc-123",
        },
      }),
    );

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["X-Hermes-Session-Key"]).toBe("company-1:sub-9");
    // #20: same conversation (sessionId abc-123) under a real sub-account yields a
    // thread id scoped to that sub-account.
    expect(headers["X-Hermes-Session-Id"]).toBe("abc-123:sub-9");
  });

  it("#20: a sub-account switch on the same conversation forks a fresh thread id, and same-scope resumes", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(200, { choices: [{ message: { content: "ok" } }] }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const idFor = async (bridgeSubAccountId?: string) => {
      fetchMock.mockClear();
      await execute(
        makeCtx({
          context: {
            bridgeChatPrompt: "hi",
            bridgeSubAccountId,
            taskKey: "plugin:orbit-chat:session:abc-123",
          },
        }),
      );
      const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
      return (init.headers as Record<string, string>)["X-Hermes-Session-Id"];
    };

    const business = await idFor(undefined);
    const subA = await idFor("sub-A");
    const subB = await idFor("sub-B");
    const subAAgain = await idFor("sub-A");

    // Each scope is a distinct thread — no carry-over across a switch...
    expect(new Set([business, subA, subB]).size).toBe(3);
    // ...and returning to a scope resumes the same thread.
    expect(subAAgain).toBe(subA);
  });

  it("scopes the memory key to companyId:_business when no sub-account is present", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(200, { choices: [{ message: { content: "ok" } }] }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await execute(makeCtx({ context: { bridgeChatPrompt: "hi" } }));

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["X-Hermes-Session-Key"]).toBe("company-1:_business");
  });

  it("emits no session key (never a bare ':_business') when companyId is absent", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(200, { choices: [{ message: { content: "ok" } }] }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await execute(
      makeCtx({
        agent: {
          id: "agent-1",
          companyId: "",
          name: "Agent",
          adapterType: "hermes_openai",
          adapterConfig: {},
        },
        context: { bridgeChatPrompt: "hi" },
      }),
    );

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["X-Hermes-Session-Key"]).toBeUndefined();
  });

  it("emits an audit log line with the composed session key for mixup detection", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(200, { choices: [{ message: { content: "ok" } }] }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await execute(
      makeCtx({ context: { bridgeChatPrompt: "hi", bridgeSubAccountId: "sub-9" } }),
    );

    expect(loggerInfoSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: "run-1",
        companyId: "company-1",
        subAccountId: "sub-9",
        hermesSessionKey: "company-1:sub-9",
      }),
      expect.stringContaining("session key"),
    );
  });

  it("audit-logs the _business scope when no sub-account is present", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(200, { choices: [{ message: { content: "ok" } }] }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await execute(makeCtx({ context: { bridgeChatPrompt: "hi" } }));

    expect(loggerInfoSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        subAccountId: "_business",
        hermesSessionKey: "company-1:_business",
      }),
      expect.stringContaining("session key"),
    );
  });

  it("falls back to agent id for the session header when taskKey has no session segment (scoped by #20)", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(200, { choices: [{ message: { content: "ok" } }] }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await execute(makeCtx({ context: { bridgeChatPrompt: "hi" } }));
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    // #20: the agent-id fallback is the constant-per-agent thread that would
    // otherwise bridge scopes; it is now scoped like any other thread id.
    expect(headers["X-Hermes-Session-Id"]).toBe("agent-1:_business");
  });

  it("falls back to paperclipChatMarkdown when bridgeChatPrompt is empty", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(200, { choices: [{ message: { content: "ok" } }] }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await execute(makeCtx({ context: { paperclipChatMarkdown: "from markdown" } }));
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.messages).toEqual([{ role: "user", content: "from markdown" }]);
  });

  it("routes through a dispatcher when HERMES_OUTBOUND_PROXY is set", async () => {
    process.env.HERMES_OUTBOUND_PROXY = "http://proxy.internal:3128";
    const fetchMock = vi.fn(async () =>
      jsonResponse(200, { choices: [{ message: { content: "ok" } }] }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await execute(makeCtx());
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit & { dispatcher?: unknown }];
    expect(init.dispatcher).toBeDefined();
  });

  it("sends the run/agent tenant-scope headers on the single request", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(200, { choices: [{ message: { content: "ok" } }] }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await execute(
      makeCtx({
        context: {
          bridgeChatPrompt: "hi",
          bridgeSubAccountId: "sub-9",
          projectId: "project-1",
        },
      }),
    );

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["X-Hermes-Session-Key"]).toBe("company-1:sub-9");
    expect(headers["X-Hermes-Run-Id"]).toBe("run-1");
    expect(headers["X-Hermes-Agent-Id"]).toBe("agent-1");
    expect(headers["X-Hermes-Project-Id"]).toBe("project-1");
    // companyId and subAccountId ride discrete headers, not a re-parse of the
    // memory-pool session key. Hermes echoes them into `_paperclip_context`, and
    // the MCP server fails a plugin-tool call closed without companyId.
    expect(headers["X-Hermes-Company-Id"]).toBe("company-1");
    expect(headers["X-Hermes-Sub-Account-Id"]).toBe("sub-9");
  });

  it("omits X-Hermes-Sub-Account-Id for business-scoped runs instead of sending _business", async () => {
    // Absence is the wire signal for business/oversight scope. The `_business`
    // sentinel belongs only in the memory-pool session key — sending it as a
    // sub-account id would make the WorkPipe tools treat it as a real sub-account
    // instead of failing closed.
    const fetchMock = vi.fn(async () =>
      jsonResponse(200, { choices: [{ message: { content: "ok" } }] }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await execute(makeCtx({ context: { bridgeChatPrompt: "hi" } }));

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["X-Hermes-Session-Key"]).toBe("company-1:_business");
    expect(headers["X-Hermes-Sub-Account-Id"]).toBeUndefined();
    // Company scope is still asserted, so the run is identified, just not narrowed.
    expect(headers["X-Hermes-Company-Id"]).toBe("company-1");
  });

  it("omits X-Hermes-Project-Id for company-scoped runs with no project", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(200, { choices: [{ message: { content: "ok" } }] }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await execute(makeCtx({ context: { bridgeChatPrompt: "hi" } }));

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["X-Hermes-Project-Id"]).toBeUndefined();
    // Run/agent scope is still mandatory on every request.
    expect(headers["X-Hermes-Run-Id"]).toBe("run-1");
    expect(headers["X-Hermes-Agent-Id"]).toBe("agent-1");
  });

  it("is single-shot: never advertises tools and never loops on tool_calls", async () => {
    // Tool calling now lives in the MCP server, not in this adapter. Even if the
    // upstream model echoes a tool_calls block, the adapter must return the single
    // response as-is rather than dispatching anything or issuing a second request.
    const fetchMock = vi.fn(async () =>
      jsonResponse(200, {
        choices: [
          {
            message: {
              content: "final answer",
              tool_calls: [
                {
                  id: "call-1",
                  type: "function",
                  function: { name: "plugin_orbit_x2e_workpipe_x2d_tools__listPipelines", arguments: "{}" },
                },
              ],
            },
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await execute(makeCtx({ context: { bridgeChatPrompt: "show me the pipelines" } }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.tools).toBeUndefined();
    expect(body.messages.every((message: { role?: string }) => message.role !== "tool")).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.summary).toBe("final answer");
  });

  it("returns an error result on 401 without emitting a result line", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(401, { error: "unauthorized" }));
    vi.stubGlobal("fetch", fetchMock);

    const onLog = vi.fn(async () => {});
    const result = await execute(makeCtx({ onLog }));

    expect(result.exitCode).toBeNull();
    expect(result.errorCode).toBe("http_401");
    expect(result.errorMessage).toBe("Hermes auth failed (401)");
    expect(onLog).not.toHaveBeenCalled();
  });

  it("returns a config error when the api key env is missing", async () => {
    delete process.env.HERMES_API_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await execute(makeCtx());
    expect(result.errorCode).toBe("config");
    expect(result.errorMessage).toBe("Hermes API key env not set");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
