import { describe, expect, it, vi } from "vitest";
import type { PluginContext, ToolResult, ToolRunContext } from "@paperclipai/plugin-sdk";
import plugin from "./plugin.js";

const JWT_SECRET_REF = "WORKPIPE_JWT_SECRET";
const JWT_SECRET = "test-secret-0123456789-abcdefghijklmnop";
const INSTANCE_ORG_ID = "instance-org-uuid";
const COMPANY_ORG_ID = "per-company-org-uuid";
const SUB_ACCOUNT_ID = "sub-account-uuid";
const ORG_A = "company-a-org-uuid";
const ORG_Orbit = "orbit-instance-org-uuid";
const PIPELINE_ID = "pipeline-uuid";
const CONTACT_ID = "contact-uuid";

type ToolHandler = (params: unknown, runCtx: ToolRunContext) => Promise<ToolResult>;

interface FetchCall {
  url: URL;
  init?: RequestInit;
}

interface MockState {
  ctx: PluginContext;
  fetches: FetchCall[];
}

function makeMockCtx(opts: { portalOrgId?: string } = {}): MockState {
  const fetches: FetchCall[] = [];
  const config: Record<string, unknown> = {
    jwtSecretRef: JWT_SECRET_REF,
    portalOrgId: opts.portalOrgId ?? INSTANCE_ORG_ID,
  };

  const ctx = {
    config: {
      get: vi.fn(async () => config),
    },
    secrets: {
      resolve: vi.fn(async (ref: string) => (ref === JWT_SECRET_REF ? JWT_SECRET : "")),
    },
    http: {
      fetch: vi.fn(async (url: string, init?: RequestInit) => {
        const parsed = new URL(url);
        fetches.push({ url: parsed, init });
        if (parsed.pathname === "/api/internal/pipelines") {
          return new Response(JSON.stringify({ pipelines: [{ id: PIPELINE_ID, name: "Sales" }] }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        if (parsed.pathname === "/api/internal/contacts") {
          return new Response(
            JSON.stringify({ contacts: [{ id: CONTACT_ID, name: "Ada" }], total: 1 }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        return new Response("{}", { status: 404, statusText: "Not Found" });
      }),
    },
    tools: {
      register: vi.fn(),
    },
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
  } as unknown as PluginContext;

  return { ctx, fetches };
}

function makeRunCtx(overrides: Partial<ToolRunContext> = {}): ToolRunContext {
  return {
    agentId: "agent-uuid",
    runId: "run-uuid",
    companyId: "company-uuid",
    subAccountId: SUB_ACCOUNT_ID,
    ...overrides,
  };
}

async function loadHandlers(ctx: PluginContext): Promise<Record<string, ToolHandler>> {
  await plugin.definition.setup?.(ctx);
  const handlers: Record<string, ToolHandler> = {};
  const register = ctx.tools.register as unknown as {
    mock: { calls: Array<[string, unknown, ToolHandler]> };
  };
  for (const [name, , handler] of register.mock.calls) {
    handlers[name] = handler;
  }
  return handlers;
}

/** Decode the HS256 payload the plugin minted, without pulling in a JWT dependency. */
function decodeTokenPayload(token: string): Record<string, unknown> {
  const [, encodedPayload] = token.split(".");
  const base64 = encodedPayload.replace(/-/g, "+").replace(/_/g, "/");
  return JSON.parse(Buffer.from(base64, "base64").toString("utf8")) as Record<string, unknown>;
}

function bearerPayload(call: FetchCall): Record<string, unknown> {
  const headers = (call.init?.headers ?? {}) as Record<string, string>;
  const authorization = headers.Authorization ?? "";
  expect(authorization.startsWith("Bearer ")).toBe(true);
  return decodeTokenPayload(authorization.slice("Bearer ".length));
}

describe("workpipe-tools per-company portal org", () => {
  it("mints the token with runCtx.portalOrgId when the host supplies one (listPipelines)", async () => {
    const { ctx, fetches } = makeMockCtx();
    const handlers = await loadHandlers(ctx);

    const result = await handlers.listPipelines({}, makeRunCtx({ portalOrgId: COMPANY_ORG_ID }));

    expect(fetches).toHaveLength(1);
    expect(bearerPayload(fetches[0]).org_id).toBe(COMPANY_ORG_ID);
    expect(bearerPayload(fetches[0]).org_id).not.toBe(INSTANCE_ORG_ID);
    expect((result.data as Record<string, unknown>).orgId).toBe(COMPANY_ORG_ID);
  });

  it("mints the token with runCtx.portalOrgId when the host supplies one (findContact)", async () => {
    const { ctx, fetches } = makeMockCtx();
    const handlers = await loadHandlers(ctx);

    const result = await handlers.findContact({ query: "ada" }, makeRunCtx({ portalOrgId: COMPANY_ORG_ID }));

    expect(fetches).toHaveLength(1);
    expect(bearerPayload(fetches[0]).org_id).toBe(COMPANY_ORG_ID);
    expect((result.data as Record<string, unknown>).orgId).toBe(COMPANY_ORG_ID);
  });

  it("honours runCtx.portalOrgId from all four tools", async () => {
    const cases: Array<[string, unknown]> = [
      ["listPipelines", {}],
      ["getPipeline", { id: PIPELINE_ID }],
      ["findContact", { query: "ada" }],
      ["getContact", { id: CONTACT_ID }],
    ];

    for (const [name, params] of cases) {
      const { ctx, fetches } = makeMockCtx();
      const handlers = await loadHandlers(ctx);

      await handlers[name](params, makeRunCtx({ portalOrgId: COMPANY_ORG_ID }));

      expect(fetches.length, `${name} made no outbound call`).toBeGreaterThan(0);
      for (const call of fetches) {
        expect(bearerPayload(call).org_id, `${name} minted the wrong org_id`).toBe(COMPANY_ORG_ID);
      }
    }
  });

  it("fails closed when runCtx carries no portalOrgId, even with an instance config org", async () => {
    const { ctx, fetches } = makeMockCtx();
    const handlers = await loadHandlers(ctx);

    await expect(handlers.listPipelines({}, makeRunCtx())).rejects.toThrow(
      /not scoped to a WorkPipe organization/,
    );
    expect(fetches).toHaveLength(0);
    expect(ctx.http.fetch).not.toHaveBeenCalled();
  });

  it("fails closed when runCtx.portalOrgId is empty or blank, even with an instance config org", async () => {
    for (const blank of ["", "   "]) {
      const { ctx, fetches } = makeMockCtx();
      const handlers = await loadHandlers(ctx);

      await expect(
        handlers.findContact({ query: "ada" }, makeRunCtx({ portalOrgId: blank })),
      ).rejects.toThrow(/not scoped to a WorkPipe organization/);
      expect(fetches, `blank portalOrgId ${JSON.stringify(blank)} leaked an outbound call`).toHaveLength(0);
      expect(ctx.http.fetch).not.toHaveBeenCalled();
    }
  });

  it("fails closed from every tool when the host supplies no org", async () => {
    const cases: Array<[string, unknown]> = [
      ["listPipelines", {}],
      ["getPipeline", { id: PIPELINE_ID }],
      ["findContact", { query: "ada" }],
      ["getContact", { id: CONTACT_ID }],
    ];

    for (const [name, params] of cases) {
      const { ctx, fetches } = makeMockCtx();
      const handlers = await loadHandlers(ctx);

      await expect(handlers[name](params, makeRunCtx()), `${name} did not fail closed`).rejects.toThrow(
        /not scoped to a WorkPipe organization/,
      );
      expect(fetches, `${name} made an outbound call without a host org`).toHaveLength(0);
    }
  });

  it("fails closed when the instance config carries no org either", async () => {
    const { ctx, fetches } = makeMockCtx({ portalOrgId: "" });
    const handlers = await loadHandlers(ctx);

    await expect(handlers.listPipelines({}, makeRunCtx())).rejects.toThrow(
      /not scoped to a WorkPipe organization/,
    );
    expect(fetches).toHaveLength(0);
  });
});

describe("workpipe-tools cross-tenant isolation", () => {
  it("company A mints its own org, and company B cannot borrow A's or the instance's org", async () => {
    // (a) Company A: the host resolved a per-company row, so A mints ORG_A.
    const a = makeMockCtx({ portalOrgId: INSTANCE_ORG_ID });
    const aHandlers = await loadHandlers(a.ctx);

    const aResult = await aHandlers.listPipelines(
      {},
      makeRunCtx({ companyId: "company-a", portalOrgId: ORG_A }),
    );

    expect(a.fetches).toHaveLength(1);
    expect(bearerPayload(a.fetches[0]).org_id).toBe(ORG_A);
    expect((aResult.data as Record<string, unknown>).orgId).toBe(ORG_A);

    // (b) Company B: no per-company row, so the host injects no portalOrgId.
    // The instance config still carries Orbit's org — B must NOT be able to use
    // it (nor A's). No token is minted and no request leaves the process.
    const b = makeMockCtx({ portalOrgId: ORG_Orbit });
    const bHandlers = await loadHandlers(b.ctx);

    await expect(
      bHandlers.listPipelines({}, makeRunCtx({ companyId: "company-b" })),
    ).rejects.toThrow(/not scoped to a WorkPipe organization/);

    expect(b.fetches).toHaveLength(0);
    expect(b.ctx.http.fetch).not.toHaveBeenCalled();

    // And nothing carrying ORG_A or ORG_Orbit ever went out on B's behalf.
    expect(b.fetches.map((call) => call.url.toString())).toEqual([]);
  });
});

describe("workpipe-tools sub-account scoping (regression)", () => {
  it("scopes every request to runCtx.subAccountId regardless of the resolved org", async () => {
    const { ctx, fetches } = makeMockCtx();
    const handlers = await loadHandlers(ctx);

    await handlers.listPipelines({}, makeRunCtx({ portalOrgId: COMPANY_ORG_ID }));

    expect(fetches[0].url.searchParams.get("subAccountId")).toBe(SUB_ACCOUNT_ID);
  });

  it("rejects runs that are not sub-account scoped, even with a per-company org", async () => {
    const { ctx, fetches } = makeMockCtx();
    const handlers = await loadHandlers(ctx);

    await expect(
      handlers.listPipelines({}, makeRunCtx({ subAccountId: null, portalOrgId: COMPANY_ORG_ID })),
    ).rejects.toThrow(/not scoped to a sub-account/);
    expect(fetches).toHaveLength(0);
  });
});
