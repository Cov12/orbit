import { describe, expect, it, vi } from "vitest";
import type {
  AgentRunSummary,
  PluginApiRequestInput,
  PluginContext,
} from "@paperclipai/plugin-sdk";
import { handleHistoryRequest } from "./history-handler.js";

const SHARED_SECRET = "test-secret-0123456789-abcdefghijklmnop";
const COMPANY_ID = "company-uuid";
const AGENT_ID = "agent-uuid";
const SUB_ACCOUNT_ID = "sub-account-1";

interface MockState {
  ctx: PluginContext;
  listCalls: Array<{
    companyId: string;
    agentId?: string;
    limit?: number;
    subAccountId?: string;
  }>;
}

function makeMockCtx(opts: {
  sharedSecret?: string | null;
  runs?: AgentRunSummary[];
  listReject?: Error;
} = {}): MockState {
  const config: Record<string, unknown> = {};
  if (opts.sharedSecret !== null) {
    config.sharedSecret = opts.sharedSecret ?? SHARED_SECRET;
  }

  const state: Omit<MockState, "ctx"> = { listCalls: [] };

  const ctx = {
    config: {
      get: vi.fn(async () => config),
    },
    agents: {
      runs: {
        list: vi.fn(async (input: {
          companyId: string;
          agentId?: string;
          limit?: number;
          subAccountId?: string;
        }): Promise<AgentRunSummary[]> => {
          state.listCalls.push(input);
          if (opts.listReject) throw opts.listReject;
          // Faithful stand-in for the host: apply the server-side sub-account
          // filter so tests exercise the scoping contract end-to-end.
          const all = opts.runs ?? [];
          return input.subAccountId
            ? all.filter((run) => run.subAccountId === input.subAccountId)
            : all;
        }),
      },
    },
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
  } as unknown as PluginContext;

  return { ...state, ctx };
}

function makeRequest(input: {
  body?: unknown;
  headers?: Record<string, string>;
  companyId?: string;
} = {}): PluginApiRequestInput {
  return {
    routeKey: "history",
    method: "POST",
    path: "/history",
    params: {},
    query: {},
    body: input.body ?? { companyId: COMPANY_ID },
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

function makeRun(overrides: Partial<AgentRunSummary> = {}): AgentRunSummary {
  return {
    id: overrides.id ?? "run-1",
    status: overrides.status ?? "succeeded",
    agentId: overrides.agentId ?? AGENT_ID,
    createdAt: overrides.createdAt ?? "2026-07-05T12:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-07-05T12:01:00.000Z",
    subAccountId: overrides.subAccountId ?? null,
  };
}

describe("handleHistoryRequest auth", () => {
  it("returns 401 when X-Orbit-Bridge-Secret is missing", async () => {
    const mock = makeMockCtx();
    const res = await handleHistoryRequest(mock.ctx, makeRequest({ headers: {} }));
    expect(res.status).toBe(401);
    expect(mock.listCalls).toHaveLength(0);
  });

  it("returns 401 when the secret does not match", async () => {
    const mock = makeMockCtx();
    const res = await handleHistoryRequest(
      mock.ctx,
      makeRequest({ headers: { "x-orbit-bridge-secret": "wrong-secret" } }),
    );
    expect(res.status).toBe(401);
    expect(mock.listCalls).toHaveLength(0);
  });

  it("returns 500 if no shared secret is configured", async () => {
    const mock = makeMockCtx({ sharedSecret: null });
    const res = await handleHistoryRequest(mock.ctx, makeRequest());
    expect(res.status).toBe(500);
  });
});

describe("handleHistoryRequest scope", () => {
  it("returns 403 when the body companyId does not match the request scope", async () => {
    const mock = makeMockCtx();
    const res = await handleHistoryRequest(
      mock.ctx,
      makeRequest({ body: { companyId: "other-company" } }),
    );
    expect(res.status).toBe(403);
    expect(mock.listCalls).toHaveLength(0);
  });

  it("returns 400 when companyId is missing", async () => {
    const mock = makeMockCtx();
    const res = await handleHistoryRequest(mock.ctx, makeRequest({ body: {} }));
    expect(res.status).toBe(400);
    expect(mock.listCalls).toHaveLength(0);
  });
});

describe("handleHistoryRequest results", () => {
  it("returns the compact run shape for a company", async () => {
    const runs = [makeRun({ id: "run-1" }), makeRun({ id: "run-2", status: "running" })];
    const mock = makeMockCtx({ runs });
    const res = await handleHistoryRequest(mock.ctx, makeRequest());
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      companyId: COMPANY_ID,
      subAccountId: null,
      runs,
    });
    expect(mock.listCalls[0]).toMatchObject({ companyId: COMPANY_ID });
  });

  it("threads subAccountId from the body and scopes the result", async () => {
    const scoped = makeRun({ id: "scoped", subAccountId: SUB_ACCOUNT_ID });
    const other = makeRun({ id: "other", subAccountId: "sub-account-2" });
    const mock = makeMockCtx({ runs: [scoped, other] });
    const res = await handleHistoryRequest(
      mock.ctx,
      makeRequest({ body: { companyId: COMPANY_ID, subAccountId: SUB_ACCOUNT_ID } }),
    );
    expect(res.status).toBe(200);
    expect(mock.listCalls[0]).toMatchObject({
      companyId: COMPANY_ID,
      subAccountId: SUB_ACCOUNT_ID,
    });
    const body = res.body as { subAccountId: string | null; runs: AgentRunSummary[] };
    expect(body.subAccountId).toBe(SUB_ACCOUNT_ID);
    expect(body.runs.map((run) => run.id)).toEqual(["scoped"]);
  });

  it("returns 502 when the host list call fails", async () => {
    const mock = makeMockCtx({ listReject: new Error("boom") });
    const res = await handleHistoryRequest(mock.ctx, makeRequest());
    expect(res.status).toBe(502);
  });
});
