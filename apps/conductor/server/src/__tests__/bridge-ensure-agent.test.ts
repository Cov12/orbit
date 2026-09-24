import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The route reaches the DB only through three domain services; mock those so the test drives
// the route's provisioning logic (auth, company-ensure, idempotency, clone) against in-memory
// state instead of a live Postgres. Shared module-level stores let each service view mutate
// the same fixtures across the request.
interface FakeCompany {
  id: string;
  name: string;
}
interface FakeAgent {
  id: string;
  companyId: string;
  name: string;
  role: string;
  title: string | null;
  capabilities: string | null;
  adapterType: string;
  adapterConfig: Record<string, unknown>;
  runtimeConfig: Record<string, unknown>;
  budgetMonthlyCents: number;
  status: string;
  reportsTo: string | null;
  metadata: Record<string, unknown> | null;
}

const store: { companies: FakeCompany[]; agents: FakeAgent[]; nextId: number } = {
  companies: [],
  agents: [],
  nextId: 1,
};

// Gate-5 CEO seed. Mocked so these stay unit tests: the real bootstrap reaches instructions,
// access grants and the activity log. The fake keeps the contract that matters here — idempotent
// (one CEO per company, `created:false` on re-run) and returning the company's ceoId.
const bootstrapCalls: string[] = [];
let bootstrapImpl: (companyId: string) => Promise<{ ceoId: string; created: boolean }>;

function seedingBootstrap(companyId: string): Promise<{ ceoId: string; created: boolean }> {
  const existing = store.agents.find((a) => a.companyId === companyId && a.role === "ceo");
  if (existing) return Promise.resolve({ ceoId: existing.id, created: false });
  const ceo: FakeAgent = {
    id: `agent-${store.nextId++}`,
    companyId,
    name: "CEO",
    role: "ceo",
    title: "Chief Executive Officer",
    capabilities: null,
    adapterType: "codex_local",
    adapterConfig: { model: "gpt-5.4" },
    runtimeConfig: {},
    budgetMonthlyCents: 0,
    status: "idle",
    reportsTo: null,
    metadata: { orbit_bootstrap_ceo: true },
  };
  store.agents.push(ceo);
  return Promise.resolve({ ceoId: ceo.id, created: true });
}

vi.mock("../services/onboarding-bootstrap.js", () => ({
  bootstrapCompanyAgents: (_db: unknown, companyId: string) => {
    bootstrapCalls.push(companyId);
    return bootstrapImpl(companyId);
  },
}));

vi.mock("../services/plugin-registry.js", () => ({
  // Force the env-var fallback path in resolveBridgeSecret by reporting no installed plugin.
  pluginRegistryService: () => ({
    getByKey: async () => null,
    getConfig: async () => null,
  }),
}));

vi.mock("../services/companies.js", () => ({
  companyService: () => ({
    getById: async (id: string) => store.companies.find((c) => c.id === id) ?? null,
    create: async (data: { id: string; name: string }) => {
      if (store.companies.some((c) => c.id === data.id)) {
        const err = new Error("duplicate key value violates unique constraint") as Error & { code: string };
        err.code = "23505";
        throw err;
      }
      const row = { id: data.id, name: data.name };
      store.companies.push(row);
      return row;
    },
  }),
}));

vi.mock("../services/agents.js", () => ({
  agentService: () => ({
    list: async (companyId: string) =>
      store.agents.filter((a) => a.companyId === companyId && a.status !== "terminated"),
    getById: async (id: string) => store.agents.find((a) => a.id === id) ?? null,
    create: async (companyId: string, data: Omit<FakeAgent, "id" | "companyId" | "reportsTo"> & { reportsTo?: string | null }) => {
      // Mirror agentService.create: a manager must exist in the same company (ensureManager).
      if (data.reportsTo) {
        const manager = store.agents.find((a) => a.id === data.reportsTo);
        if (!manager || manager.companyId !== companyId) throw new Error("Manager not found");
      }
      const row: FakeAgent = { reportsTo: null, ...data, id: `agent-${store.nextId++}`, companyId };
      store.agents.push(row);
      return row;
    },
    update: async (id: string, patch: Partial<FakeAgent>) => {
      const row = store.agents.find((a) => a.id === id);
      if (!row) return null;
      updateCalls.push({ id, patch });
      Object.assign(row, patch);
      return row;
    },
  }),
}));

// Records every agents.update so "re-parented exactly once" is assertable.
const updateCalls: { id: string; patch: Partial<FakeAgent> }[] = [];

import { bridgeEnsureAgentRoutes } from "../routes/bridge-ensure-agent.js";

const BRIDGE_SECRET = "bridge-secret-for-tests-0123456789";
const SECRET_HEADER = "x-orbit-bridge-secret";
const ENDPOINT = "/api/bridge/ensure-agent";
const TEMPLATE_ID = "00000000-0000-4000-a000-0000000a9e01";
const COMPANY_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

const originalSecret = process.env.ORBIT_BRIDGE_SECRET;
const originalTemplate = process.env.CONDUCTOR_ASSISTANT_TEMPLATE_AGENT_ID;

function seedTemplate(overrides: Partial<FakeAgent> = {}): FakeAgent {
  const template: FakeAgent = {
    id: TEMPLATE_ID,
    companyId: "00000000-0000-4000-a000-000000000001",
    name: "Assistant",
    role: "assistant",
    title: "Orbit Assistant",
    capabilities: "chat",
    adapterType: "hermes_openai",
    adapterConfig: { model: "gpt-5.4" },
    runtimeConfig: { heartbeat: { maxConcurrentRuns: 1 } },
    budgetMonthlyCents: 5000,
    status: "idle",
    reportsTo: null,
    metadata: { seeded: true },
    ...overrides,
  };
  store.agents.push(template);
  return template;
}

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(bridgeEnsureAgentRoutes({} as unknown as Parameters<typeof bridgeEnsureAgentRoutes>[0]));
  return app;
}

beforeEach(() => {
  store.companies = [];
  store.agents = [];
  store.nextId = 1;
  bootstrapCalls.length = 0;
  updateCalls.length = 0;
  bootstrapImpl = seedingBootstrap;
  process.env.ORBIT_BRIDGE_SECRET = BRIDGE_SECRET;
  delete process.env.CONDUCTOR_ASSISTANT_TEMPLATE_AGENT_ID;
});

afterEach(() => {
  if (originalSecret === undefined) delete process.env.ORBIT_BRIDGE_SECRET;
  else process.env.ORBIT_BRIDGE_SECRET = originalSecret;
  if (originalTemplate === undefined) delete process.env.CONDUCTOR_ASSISTANT_TEMPLATE_AGENT_ID;
  else process.env.CONDUCTOR_ASSISTANT_TEMPLATE_AGENT_ID = originalTemplate;
});

describe.sequential("bridge ensure-agent", () => {
  it("returns 401 for a missing secret and provisions nothing", async () => {
    seedTemplate();
    const app = createApp();
    const res = await request(app).post(ENDPOINT).send({ companyId: COMPANY_ID });
    expect(res.status).toBe(401);
    expect(store.agents.filter((a) => a.companyId === COMPANY_ID)).toHaveLength(0);
  });

  it("returns 401 for a wrong secret", async () => {
    seedTemplate();
    const app = createApp();
    const res = await request(app)
      .post(ENDPOINT)
      .set(SECRET_HEADER, "wrong")
      .send({ companyId: COMPANY_ID });
    expect(res.status).toBe(401);
  });

  it("returns 400 for malformed bodies", async () => {
    seedTemplate();
    const app = createApp();
    const malformed = [{}, { companyId: "" }, { companyId: "not-a-uuid" }, { companyId: 123 }];
    for (const body of malformed) {
      const res = await request(app).post(ENDPOINT).set(SECRET_HEADER, BRIDGE_SECRET).send(body);
      expect(res.status).toBe(400);
    }
    expect(store.agents.filter((a) => a.companyId === COMPANY_ID)).toHaveLength(0);
  });

  it("clones the template into the company, creating the company row and stamping the marker", async () => {
    const template = seedTemplate();
    const app = createApp();

    const res = await request(app)
      .post(ENDPOINT)
      .set(SECRET_HEADER, BRIDGE_SECRET)
      .send({ companyId: COMPANY_ID });

    expect(res.status).toBe(200);
    expect(typeof res.body.agentId).toBe("string");

    // Company was auto-created.
    expect(store.companies.find((c) => c.id === COMPANY_ID)).toBeTruthy();

    // A new assistant now lives in the company, distinct from the template.
    const provisioned = store.agents.find((a) => a.id === res.body.agentId);
    expect(provisioned).toBeTruthy();
    expect(provisioned!.companyId).toBe(COMPANY_ID);
    expect(provisioned!.id).not.toBe(template.id);

    // Config fields (incl. the model-bearing adapterConfig) were copied verbatim.
    expect(provisioned!.adapterType).toBe(template.adapterType);
    expect(provisioned!.adapterConfig).toEqual(template.adapterConfig);
    expect(provisioned!.runtimeConfig).toEqual(template.runtimeConfig);
    expect(provisioned!.role).toBe(template.role);
    expect(provisioned!.title).toBe(template.title);
    expect(provisioned!.capabilities).toBe(template.capabilities);
    expect(provisioned!.budgetMonthlyCents).toBe(template.budgetMonthlyCents);

    // Idempotency marker stamped, template metadata preserved.
    expect(provisioned!.metadata).toMatchObject({ orbit_bridge_assistant: true, seeded: true });
  });

  it("is idempotent: two calls return the same agent id with no duplicate", async () => {
    seedTemplate();
    const app = createApp();

    const send = () =>
      request(app).post(ENDPOINT).set(SECRET_HEADER, BRIDGE_SECRET).send({ companyId: COMPANY_ID });

    const first = await send();
    const second = await send();

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.agentId).toBe(first.body.agentId);

    // Exactly one assistant provisioned in the company (the template lives elsewhere).
    const inCompany = store.agents.filter(
      (a) => a.companyId === COMPANY_ID && a.metadata?.orbit_bridge_assistant === true,
    );
    expect(inCompany).toHaveLength(1);
    expect(inCompany[0]!.metadata).toMatchObject({ orbit_bridge_assistant: true });
  });

  it("does not re-create the company row when it already exists", async () => {
    seedTemplate();
    store.companies.push({ id: COMPANY_ID, name: "Existing Co" });
    const app = createApp();

    const res = await request(app)
      .post(ENDPOINT)
      .set(SECRET_HEADER, BRIDGE_SECRET)
      .send({ companyId: COMPANY_ID });

    expect(res.status).toBe(200);
    expect(store.companies.filter((c) => c.id === COMPANY_ID)).toHaveLength(1);
    expect(store.companies.find((c) => c.id === COMPANY_ID)!.name).toBe("Existing Co");
  });

  it("returns 500 when the template agent is missing", async () => {
    // No template seeded.
    const app = createApp();
    const res = await request(app)
      .post(ENDPOINT)
      .set(SECRET_HEADER, BRIDGE_SECRET)
      .send({ companyId: COMPANY_ID });
    expect(res.status).toBe(500);
  });

  it("honors CONDUCTOR_ASSISTANT_TEMPLATE_AGENT_ID override", async () => {
    const customId = "99999999-1111-4222-8333-444444444444";
    seedTemplate({ id: customId, name: "Custom", adapterConfig: { model: "custom-model" } });
    process.env.CONDUCTOR_ASSISTANT_TEMPLATE_AGENT_ID = customId;
    const app = createApp();

    const res = await request(app)
      .post(ENDPOINT)
      .set(SECRET_HEADER, BRIDGE_SECRET)
      .send({ companyId: COMPANY_ID });

    expect(res.status).toBe(200);
    const provisioned = store.agents.find((a) => a.id === res.body.agentId);
    expect(provisioned!.adapterConfig).toEqual({ model: "custom-model" });
  });

  // -------------------------------------------------------------------------
  // Gate 5: CEO back-fill + assistant parenting.
  // -------------------------------------------------------------------------

  it("parents the cloned assistant to the CEO seeded when the company was created", async () => {
    seedTemplate();
    // A company created through the Gate-3 path already carries its CEO.
    store.companies.push({ id: COMPANY_ID, name: "Seeded Co" });
    const { ceoId } = await seedingBootstrap(COMPANY_ID);
    const app = createApp();

    const res = await request(app)
      .post(ENDPOINT)
      .set(SECRET_HEADER, BRIDGE_SECRET)
      .send({ companyId: COMPANY_ID });

    expect(res.status).toBe(200);
    const provisioned = store.agents.find((a) => a.id === res.body.agentId);
    expect(provisioned!.reportsTo).toBe(ceoId);

    // The unconditional call was a no-op: still exactly one CEO.
    expect(bootstrapCalls).toEqual([COMPANY_ID]);
    expect(store.agents.filter((a) => a.companyId === COMPANY_ID && a.role === "ceo")).toHaveLength(1);
  });

  it("back-fills a CEO for a pre-existing company and parents the assistant to it", async () => {
    seedTemplate();
    // Pre-dates the feature: the company row exists (so ensureCompany early-returns) but was
    // never seeded, so the bridge is the first thing to give it a CEO.
    store.companies.push({ id: COMPANY_ID, name: "Legacy Co" });
    const app = createApp();

    const res = await request(app)
      .post(ENDPOINT)
      .set(SECRET_HEADER, BRIDGE_SECRET)
      .send({ companyId: COMPANY_ID });

    expect(res.status).toBe(200);
    expect(bootstrapCalls).toEqual([COMPANY_ID]);

    const ceo = store.agents.find((a) => a.companyId === COMPANY_ID && a.role === "ceo");
    expect(ceo).toBeTruthy();

    const provisioned = store.agents.find((a) => a.id === res.body.agentId);
    expect(provisioned!.reportsTo).toBe(ceo!.id);
  });

  it("re-parents an existing top-level assistant to the CEO exactly once", async () => {
    seedTemplate();
    store.companies.push({ id: COMPANY_ID, name: "Legacy Co" });
    // An assistant provisioned before this gate shipped: marked, but reporting to nobody.
    const orphan = seedTemplate({
      id: "77777777-1111-4222-8333-444444444444",
      companyId: COMPANY_ID,
      reportsTo: null,
      metadata: { orbit_bridge_assistant: true },
    });
    const app = createApp();

    const send = () =>
      request(app).post(ENDPOINT).set(SECRET_HEADER, BRIDGE_SECRET).send({ companyId: COMPANY_ID });

    const first = await send();
    expect(first.status).toBe(200);
    expect(first.body.agentId).toBe(orphan.id);

    const ceo = store.agents.find((a) => a.companyId === COMPANY_ID && a.role === "ceo")!;
    expect(orphan.reportsTo).toBe(ceo.id);
    expect(updateCalls).toEqual([{ id: orphan.id, patch: { reportsTo: ceo.id } }]);

    // Re-running finds it already parented and leaves it alone.
    const second = await send();
    expect(second.status).toBe(200);
    expect(second.body.agentId).toBe(orphan.id);
    expect(updateCalls).toHaveLength(1);
  });

  it("leaves an already-parented assistant untouched", async () => {
    seedTemplate();
    store.companies.push({ id: COMPANY_ID, name: "Legacy Co" });
    // Reports to a manager that is NOT the seeded CEO — an operator's deliberate placement.
    const manager = seedTemplate({
      id: "88888888-1111-4222-8333-444444444444",
      companyId: COMPANY_ID,
      name: "Ops Lead",
      role: "manager",
      metadata: {},
    });
    const assistant = seedTemplate({
      id: "77777777-1111-4222-8333-444444444444",
      companyId: COMPANY_ID,
      reportsTo: manager.id,
      metadata: { orbit_bridge_assistant: true },
    });
    const app = createApp();

    const res = await request(app)
      .post(ENDPOINT)
      .set(SECRET_HEADER, BRIDGE_SECRET)
      .send({ companyId: COMPANY_ID });

    expect(res.status).toBe(200);
    expect(res.body.agentId).toBe(assistant.id);
    expect(assistant.reportsTo).toBe(manager.id);
    expect(updateCalls).toHaveLength(0);
  });

  it("still provisions a top-level assistant when the CEO bootstrap throws", async () => {
    seedTemplate();
    bootstrapImpl = async () => {
      throw new Error("instructions bundle unavailable");
    };
    const app = createApp();

    const res = await request(app)
      .post(ENDPOINT)
      .set(SECRET_HEADER, BRIDGE_SECRET)
      .send({ companyId: COMPANY_ID });

    expect(res.status).toBe(200);
    const provisioned = store.agents.find((a) => a.id === res.body.agentId);
    expect(provisioned).toBeTruthy();
    // Degrades to exactly today's behavior: no manager, and reportsTo was never passed as null.
    expect(provisioned!.reportsTo).toBeNull();
    expect(store.agents.filter((a) => a.companyId === COMPANY_ID && a.role === "ceo")).toHaveLength(0);
  });

  it("is idempotent across re-runs: no second CEO, no second assistant, no re-parent", async () => {
    seedTemplate();
    const app = createApp();

    const send = () =>
      request(app).post(ENDPOINT).set(SECRET_HEADER, BRIDGE_SECRET).send({ companyId: COMPANY_ID });

    const first = await send();
    const second = await send();
    const third = await send();

    expect([first.status, second.status, third.status]).toEqual([200, 200, 200]);
    expect(second.body.agentId).toBe(first.body.agentId);
    expect(third.body.agentId).toBe(first.body.agentId);

    expect(bootstrapCalls).toEqual([COMPANY_ID, COMPANY_ID, COMPANY_ID]);
    expect(store.agents.filter((a) => a.companyId === COMPANY_ID && a.role === "ceo")).toHaveLength(1);
    expect(
      store.agents.filter((a) => a.companyId === COMPANY_ID && a.metadata?.orbit_bridge_assistant === true),
    ).toHaveLength(1);

    // The assistant was born parented, so no update ever fired.
    const ceo = store.agents.find((a) => a.companyId === COMPANY_ID && a.role === "ceo")!;
    expect(store.agents.find((a) => a.id === first.body.agentId)!.reportsTo).toBe(ceo.id);
    expect(updateCalls).toHaveLength(0);
  });
});
