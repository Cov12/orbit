import { describe, expect, it, vi } from "vitest";
import type {
  AgentSession,
  AgentSessionEvent,
  AgentSessionSendResult,
  PluginApiRequestInput,
  PluginContext,
} from "@paperclipai/plugin-sdk";
import { handleChatRequest } from "./route-handler.js";

const SHARED_SECRET = "test-secret-0123456789-abcdefghijklmnop";
const COMPANY_ID = "company-uuid";
const AGENT_ID = "agent-uuid";

interface StreamEvent {
  channel: string;
  event: unknown;
}

interface MockState {
  ctx: PluginContext;
  emitted: StreamEvent[];
  opened: Array<{ channel: string; companyId: string }>;
  closed: string[];
  sendMessageCalls: Array<{
    sessionId: string;
    companyId: string;
    opts: { prompt: string; reason?: string; onEvent?: (event: AgentSessionEvent) => void };
  }>;
  createSessionCalls: Array<{ agentId: string; companyId: string }>;
  triggerEvent(event: Omit<AgentSessionEvent, "sessionId">): void;
}

function makeMockCtx(opts: {
  sharedSecret?: string | null;
  sessionId?: string;
  runId?: string;
  sendMessageReject?: Error;
  events?: Array<Omit<AgentSessionEvent, "sessionId">>;
} = {}): MockState {
  const sessionId = opts.sessionId ?? "session-uuid";
  const runId = opts.runId ?? "run-uuid";

  let latestOnEvent: ((event: AgentSessionEvent) => void) | undefined;
  const state: Omit<MockState, "ctx"> = {
    emitted: [],
    opened: [],
    closed: [],
    sendMessageCalls: [],
    createSessionCalls: [],
    triggerEvent(event) {
      latestOnEvent?.({ ...event, sessionId });
    },
  };

  const config: Record<string, unknown> = {};
  if (opts.sharedSecret !== null) {
    config.sharedSecret = opts.sharedSecret ?? SHARED_SECRET;
  }

  const ctx = {
    config: {
      get: vi.fn(async () => config),
    },
    agents: {
      sessions: {
        create: vi.fn(async (agentId: string, companyId: string): Promise<AgentSession> => {
          state.createSessionCalls.push({ agentId, companyId });
          return {
            sessionId,
            agentId,
            companyId,
            status: "active",
            createdAt: new Date().toISOString(),
          };
        }),
        sendMessage: vi.fn(
          async (
            sid: string,
            cid: string,
            sendOpts: { prompt: string; reason?: string; onEvent?: (event: AgentSessionEvent) => void },
          ): Promise<AgentSessionSendResult> => {
            state.sendMessageCalls.push({ sessionId: sid, companyId: cid, opts: sendOpts });
            latestOnEvent = sendOpts.onEvent;
            if (opts.sendMessageReject) throw opts.sendMessageReject;
            // Option B: the handler blocks until a terminal `done`/`error` event
            // fires, so the events must be emitted synchronously from inside
            // sendMessage, before it returns the runId.
            for (const e of opts.events ?? []) sendOpts.onEvent?.({ ...e, sessionId });
            return { runId };
          },
        ),
      },
    },
    streams: {
      open: vi.fn((channel: string, companyId: string) => {
        state.opened.push({ channel, companyId });
      }),
      emit: vi.fn((channel: string, event: unknown) => {
        state.emitted.push({ channel, event });
      }),
      close: vi.fn((channel: string) => {
        state.closed.push(channel);
      }),
    },
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
  } as unknown as PluginContext;

  return { ...state, ctx } as MockState;
}

function makeRequest(input: {
  body?: unknown;
  headers?: Record<string, string>;
  companyId?: string;
} = {}): PluginApiRequestInput {
  return {
    routeKey: "chat",
    method: "POST",
    path: "/chat",
    params: {},
    query: {},
    body: input.body ?? {
      companyId: COMPANY_ID,
      agentId: AGENT_ID,
      prompt: "Hello agent",
    },
    actor: {
      actorType: "user",
      actorId: "service-actor",
      agentId: null,
      userId: null,
      runId: null,
    },
    companyId: input.companyId ?? COMPANY_ID,
    headers: input.headers ?? { "x-orbit-bridge-secret": SHARED_SECRET },
  };
}

describe("handleChatRequest auth", () => {
  it("returns 401 when X-Orbit-Bridge-Secret is missing", async () => {
    const mock = makeMockCtx();
    const res = await handleChatRequest(mock.ctx, makeRequest({ headers: {} }));
    expect(res.status).toBe(401);
    expect(mock.sendMessageCalls).toHaveLength(0);
    expect(mock.opened).toHaveLength(0);
  });

  it("returns 401 when the secret does not match", async () => {
    const mock = makeMockCtx();
    const res = await handleChatRequest(
      mock.ctx,
      makeRequest({ headers: { "x-orbit-bridge-secret": "wrong-secret" } }),
    );
    expect(res.status).toBe(401);
    expect(mock.sendMessageCalls).toHaveLength(0);
  });

  it("returns 500 if no shared secret is configured", async () => {
    const mock = makeMockCtx({ sharedSecret: null });
    const res = await handleChatRequest(mock.ctx, makeRequest());
    expect(res.status).toBe(500);
  });
});

describe("handleChatRequest body validation", () => {
  it("returns 400 when companyId is missing", async () => {
    const mock = makeMockCtx();
    const res = await handleChatRequest(
      mock.ctx,
      makeRequest({
        body: { agentId: AGENT_ID, prompt: "x" },
        companyId: COMPANY_ID,
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when agentId is missing", async () => {
    const mock = makeMockCtx();
    const res = await handleChatRequest(
      mock.ctx,
      makeRequest({ body: { companyId: COMPANY_ID, prompt: "x" } }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when prompt is missing", async () => {
    const mock = makeMockCtx();
    const res = await handleChatRequest(
      mock.ctx,
      makeRequest({ body: { companyId: COMPANY_ID, agentId: AGENT_ID } }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 403 when body companyId differs from request scope", async () => {
    const mock = makeMockCtx();
    const res = await handleChatRequest(
      mock.ctx,
      makeRequest({
        body: { companyId: "other-co", agentId: AGENT_ID, prompt: "hi" },
        companyId: COMPANY_ID,
      }),
    );
    expect(res.status).toBe(403);
  });
});

describe("handleChatRequest happy path", () => {
  it("creates a session when no sessionId is provided and returns 201", async () => {
    const mock = makeMockCtx({
      sessionId: "new-sess",
      runId: "run-1",
      events: [
        {
          runId: "run-1",
          seq: 1,
          eventType: "chunk",
          stream: "stdout",
          message:
            JSON.stringify({
              type: "content_block_delta",
              delta: { type: "text_delta", text: "Hello" },
            }) + "\n",
          payload: null,
        },
        {
          runId: "run-1",
          seq: 2,
          eventType: "done",
          stream: null,
          message: null,
          payload: null,
        },
      ],
    });
    const res = await handleChatRequest(mock.ctx, makeRequest());
    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      sessionId: "new-sess",
      channel: "chat-new-sess",
      runId: "run-1",
      created: true,
      response: "Hello",
    });
    expect(mock.createSessionCalls).toEqual([
      { agentId: AGENT_ID, companyId: COMPANY_ID },
    ]);
    expect(mock.sendMessageCalls[0]).toMatchObject({
      sessionId: "new-sess",
      companyId: COMPANY_ID,
      opts: { prompt: "Hello agent" },
    });
    expect(mock.opened).toEqual([{ channel: "chat-new-sess", companyId: COMPANY_ID }]);
  });

  it("skips session creation when sessionId is provided and returns 200", async () => {
    const mock = makeMockCtx({
      sessionId: "existing",
      runId: "run-2",
      events: [
        {
          runId: "run-2",
          seq: 1,
          eventType: "chunk",
          stream: "stdout",
          message:
            JSON.stringify({
              type: "content_block_delta",
              delta: { type: "text_delta", text: "Hello" },
            }) + "\n",
          payload: null,
        },
        {
          runId: "run-2",
          seq: 2,
          eventType: "done",
          stream: null,
          message: null,
          payload: null,
        },
      ],
    });
    const res = await handleChatRequest(
      mock.ctx,
      makeRequest({
        body: {
          companyId: COMPANY_ID,
          agentId: AGENT_ID,
          prompt: "follow-up",
          sessionId: "existing",
        },
      }),
    );
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      sessionId: "existing",
      channel: "chat-existing",
      runId: "run-2",
      created: false,
      response: "Hello",
    });
    expect(mock.createSessionCalls).toEqual([]);
    expect(mock.sendMessageCalls[0].sessionId).toBe("existing");
  });

  it("returns the claude-code result field as the response (Option B)", async () => {
    const mock = makeMockCtx({
      sessionId: "cc-1",
      runId: "run-cc-1",
      events: [
        {
          runId: "run-cc-1",
          seq: 1,
          eventType: "chunk",
          stream: "stdout",
          message:
            JSON.stringify({
              type: "assistant",
              message: { content: [{ type: "text", text: "partial" }] },
            }) + "\n",
          payload: null,
        },
        {
          runId: "run-cc-1",
          seq: 2,
          eventType: "chunk",
          stream: "stdout",
          message:
            JSON.stringify({
              type: "result",
              subtype: "success",
              result: "The complete final answer",
            }) + "\n",
          payload: null,
        },
        {
          runId: "run-cc-1",
          seq: 3,
          eventType: "done",
          stream: null,
          message: null,
          payload: null,
        },
      ],
    });
    const res = await handleChatRequest(
      mock.ctx,
      makeRequest({
        body: { companyId: COMPANY_ID, agentId: AGENT_ID, prompt: "hi", sessionId: "cc-1" },
      }),
    );
    expect(res.status).toBe(200);
    expect((res.body as { response: string }).response).toBe("The complete final answer");
    // result_text is still relayed to the stream.
    expect(mock.emitted).toContainEqual({
      channel: "chat-cc-1",
      event: { type: "result_text", text: "The complete final answer" },
    });
  });

  it("falls back to joined assistant text when no result event arrives", async () => {
    const mock = makeMockCtx({
      sessionId: "cc-2",
      runId: "run-cc-2",
      events: [
        {
          runId: "run-cc-2",
          seq: 1,
          eventType: "chunk",
          stream: "stdout",
          message:
            JSON.stringify({
              type: "assistant",
              message: {
                content: [
                  { type: "text", text: "Hello" },
                  { type: "text", text: " world" },
                ],
              },
            }) + "\n",
          payload: null,
        },
        {
          runId: "run-cc-2",
          seq: 2,
          eventType: "done",
          stream: null,
          message: null,
          payload: null,
        },
      ],
    });
    const res = await handleChatRequest(
      mock.ctx,
      makeRequest({
        body: { companyId: COMPANY_ID, agentId: AGENT_ID, prompt: "hi", sessionId: "cc-2" },
      }),
    );
    expect(res.status).toBe(200);
    expect((res.body as { response: string }).response).toBe("Hello world");
  });
});

describe("handleChatRequest streaming relay", () => {
  it("relays parsed text_delta tokens to the channel", async () => {
    const mock = makeMockCtx({
      sessionId: "s1",
      events: [
        {
          runId: "r1",
          seq: 1,
          eventType: "chunk",
          stream: "stdout",
          message:
            JSON.stringify({
              type: "content_block_delta",
              delta: { type: "text_delta", text: "Hi" },
            }) + "\n",
          payload: null,
        },
        {
          runId: "r1",
          seq: 2,
          eventType: "done",
          stream: null,
          message: null,
          payload: null,
        },
      ],
    });
    await handleChatRequest(mock.ctx, makeRequest());
    expect(mock.emitted).toContainEqual({
      channel: "chat-s1",
      event: { type: "token", text: "Hi" },
    });
  });

  it("forwards status events", async () => {
    const mock = makeMockCtx({
      sessionId: "s2",
      events: [
        {
          runId: "r1",
          seq: 1,
          eventType: "status",
          stream: "system",
          message: "thinking",
          payload: { detail: "x" },
        },
        {
          runId: "r1",
          seq: 2,
          eventType: "done",
          stream: null,
          message: null,
          payload: null,
        },
      ],
    });
    await handleChatRequest(mock.ctx, makeRequest());
    expect(mock.emitted).toContainEqual({
      channel: "chat-s2",
      event: { type: "status", status: "thinking", payload: { detail: "x" } },
    });
  });

  it("flushes parser tail, emits done, and closes the channel on completion", async () => {
    const trailingLine = JSON.stringify({
      type: "content_block_delta",
      delta: { type: "text_delta", text: "tail" },
    });
    const mock = makeMockCtx({
      sessionId: "s3",
      runId: "r-done",
      events: [
        {
          runId: "r-done",
          seq: 1,
          eventType: "chunk",
          stream: "stdout",
          message: trailingLine,
          payload: null,
        },
        {
          runId: "r-done",
          seq: 2,
          eventType: "done",
          stream: null,
          message: null,
          payload: null,
        },
      ],
    });
    await handleChatRequest(mock.ctx, makeRequest());
    expect(mock.emitted).toEqual([
      { channel: "chat-s3", event: { type: "token", text: "tail" } },
      { channel: "chat-s3", event: { type: "done", runId: "r-done" } },
    ]);
    expect(mock.closed).toEqual(["chat-s3"]);
  });

  it("emits an error event and closes on error events", async () => {
    const mock = makeMockCtx({
      sessionId: "s4",
      events: [
        {
          runId: "r-err",
          seq: 1,
          eventType: "error",
          stream: "stderr",
          message: "boom",
          payload: { code: 1 },
        },
      ],
    });
    const res = await handleChatRequest(mock.ctx, makeRequest());
    expect(res.status).toBe(502);
    expect(mock.emitted).toContainEqual({
      channel: "chat-s4",
      event: { type: "error", message: "boom", payload: { code: 1 } },
    });
    expect(mock.closed).toEqual(["chat-s4"]);
  });
});
