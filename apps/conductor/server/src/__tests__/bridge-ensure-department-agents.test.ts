import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeAgentPermissions } from "../services/agent-permissions.js";

// The route + specialist seed reach the DB (and the filesystem) only through domain services;
// mock those so the test drives the real provisioning logic — auth, validation, idempotency,
// role→bundle resolution — against in-memory state instead of a live Postgres. Deliberately
// NOT mocked: onboarding-bootstrap (the real CEO seed), agent-provisioning and
// default-agent-instructions, so "the role bundle materializes" is genuinely exercised.
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
  adapterType: string;
  adapterConfig: Record<string, unknown>;
  runtimeConfig: Record<string, unknown>;
  status: string;
  reportsTo: string | null;
  permissions: Record<string, unknown>;
  metadata: Record<string, unknown> | null;
}

const store: { companies: FakeCompany[]; agents: FakeAgent[]; nextId: number } = {
  companies: [],
  agents: [],
  nextId: 1,
};

/** Every materialized bundle, so role→persona-files can be asserted. */
const materialized: { agentId: string; role: string; files: Record<string, string> }[] = [];
/** Every default `tasks:assign` grant applied. */
const grants: { companyId: string; agentId: string; permission: string }[] = [];

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
    create: async (
      companyId: string,
      data: Partial<FakeAgent> & { name: string; role: string; adapterType: string },
    ) => {
      // Mirror agentService.create: a manager must exist in the same company (ensureManager)…
      if (data.reportsTo) {
        const manager = store.agents.find((a) => a.id === data.reportsTo);
        if (!manager || manager.companyId !== companyId) throw new Error("Manager not found");
      }
      const row: FakeAgent = {
        title: null,
        adapterConfig: {},
        runtimeConfig: {},
        status: "idle",
        metadata: null,
        ...data,
        reportsTo: data.reportsTo ?? null,
        id: `agent-${store.nextId++}`,
        companyId,
        // …and derive permissions from the role, which is where canCreateAgents comes from.
        permissions: normalizeAgentPermissions(data.permissions, data.role),
      };
      store.agents.push(row);
      return row;
    },
    update: async (id: string, patch: Partial<FakeAgent>) => {
      const row = store.agents.find((a) => a.id === id);
      if (!row) return null;
      Object.assign(row, patch);
      return row;
    },
  }),
}));

vi.mock("../services/access.js", () => ({
  accessService: () => ({
    ensureMembership: async () => undefined,
    setPrincipalPermission: async (
      companyId: string,
      _principalType: string,
      principalId: string,
      permission: string,
    ) => {
      grants.push({ companyId, agentId: principalId, permission });
    },
  }),
}));

vi.mock("../services/activity-log.js", () => ({
  logActivity: async () => undefined,
}));

// Filesystem writes are the only thing stubbed inside the bundle path: the REAL
// default-agent-instructions loader still reads `onboarding-assets/<role>/`, so the files
// recorded here are the actual persona bundle for the role.
vi.mock("../services/agent-instructions.js", () => ({
  agentInstructionsService: () => ({
    materializeManagedBundle: async (
      agent: { id: string; role: string; adapterConfig: Record<string, unknown> },
      files: Record<string, string>,
    ) => {
      materialized.push({ agentId: agent.id, role: agent.role, files });
      return {
        bundle: { entryFile: "AGENTS.md", files: Object.keys(files) },
        adapterConfig: {
          ...agent.adapterConfig,
          instructionsRootPath: `/bundles/${agent.id}`,
          instructionsEntryFile: "AGENTS.md",
        },
      };
    },
  }),
}));

import { bridgeEnsureDepartmentAgentsRoutes } from "../routes/bridge-ensure-department-agents.js";

const BRIDGE_SECRET = "bridge-secret-for-tests-0123456789";
const SECRET_HEADER = "x-orbit-bridge-secret";
const ENDPOINT = "/api/bridge/ensure-department-agents";
const COMPANY_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

const originalSecret = process.env.ORBIT_BRIDGE_SECRET;

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(
    bridgeEnsureDepartmentAgentsRoutes(
      {} as unknown as Parameters<typeof bridgeEnsureDepartmentAgentsRoutes>[0],
    ),
  );
  return app;
}

function post(body: unknown, secret: string | null = BRIDGE_SECRET) {
  const req = request(createApp()).post(ENDPOINT);
  if (secret !== null) req.set(SECRET_HEADER, secret);
  return req.send(body as object);
}

function specialistsOf(companyId = COMPANY_ID) {
  return store.agents.filter((a) => a.companyId === companyId && a.role !== "ceo");
}

beforeEach(() => {
  store.companies = [];
  store.agents = [];
  store.nextId = 1;
  materialized.length = 0;
  grants.length = 0;
  process.env.ORBIT_BRIDGE_SECRET = BRIDGE_SECRET;
});

afterEach(() => {
  if (originalSecret === undefined) delete process.env.ORBIT_BRIDGE_SECRET;
  else process.env.ORBIT_BRIDGE_SECRET = originalSecret;
});

describe.sequential("bridge ensure-department-agents", () => {
  // -------------------------------------------------------------------------
  // Auth
  // -------------------------------------------------------------------------

  it("returns 401 for a missing secret and provisions nothing", async () => {
    const res = await post({ companyId: COMPANY_ID, roles: ["engineer"] }, null);
    expect(res.status).toBe(401);
    expect(store.agents).toHaveLength(0);
    expect(store.companies).toHaveLength(0);
  });

  it("returns 401 for a wrong secret", async () => {
    const res = await post({ companyId: COMPANY_ID, roles: ["engineer"] }, "wrong");
    expect(res.status).toBe(401);
    expect(store.agents).toHaveLength(0);
  });

  it("returns 503 when no shared secret is configured", async () => {
    delete process.env.ORBIT_BRIDGE_SECRET;
    const res = await post({ companyId: COMPANY_ID, roles: ["engineer"] });
    expect(res.status).toBe(503);
  });

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------

  it("returns 400 for malformed bodies", async () => {
    const malformed = [
      {},
      { companyId: COMPANY_ID },
      { companyId: COMPANY_ID, roles: [] },
      { companyId: COMPANY_ID, roles: "engineer" },
      { companyId: COMPANY_ID, roles: [123] },
      { companyId: "not-a-uuid", roles: ["engineer"] },
      { companyId: "", roles: ["engineer"] },
      { roles: ["engineer"] },
    ];
    for (const body of malformed) {
      const res = await post(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
    expect(store.agents).toHaveLength(0);
  });

  it("rejects an unknown role with 400 and provisions nothing", async () => {
    const res = await post({ companyId: COMPANY_ID, roles: ["engineer", "wizard"] });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("wizard");
    expect(store.agents).toHaveLength(0);
  });

  it("rejects ceo and default with 400", async () => {
    for (const role of ["ceo", "default"]) {
      const res = await post({ companyId: COMPANY_ID, roles: [role] });
      expect(res.status, role).toBe(400);
      expect(res.body.error).toContain(role);
    }
    expect(store.agents).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // Provisioning
  // -------------------------------------------------------------------------

  it("creates a specialist with its role bundle materialized and the tasks:assign grant", async () => {
    const res = await post({ companyId: COMPANY_ID, roles: ["engineer"] });

    expect(res.status).toBe(200);
    expect(res.body.agents).toHaveLength(1);
    expect(res.body.agents[0]).toMatchObject({ role: "engineer", created: true });
    expect(typeof res.body.agents[0].agentId).toBe("string");

    // Company row was auto-created.
    expect(store.companies.find((c) => c.id === COMPANY_ID)).toBeTruthy();

    const agent = store.agents.find((a) => a.id === res.body.agents[0].agentId)!;
    expect(agent.companyId).toBe(COMPANY_ID);
    expect(agent.role).toBe("engineer");
    expect(agent.title).toBe("Software Engineer");
    expect(agent.metadata).toMatchObject({ orbit_bootstrap_specialist: "engineer" });

    // The engineer persona bundle — not the `default` fallback — was materialized, and the
    // adapterConfig now points at it.
    const bundle = materialized.find((m) => m.agentId === agent.id)!;
    expect(Object.keys(bundle.files).sort()).toEqual(["AGENTS.md", "CORE.md", "ECOSYSTEM.md", "TOOLS.md"]);
    expect(bundle.files["AGENTS.md"].length).toBeGreaterThan(0);
    expect(agent.adapterConfig).toMatchObject({ instructionsEntryFile: "AGENTS.md" });

    // Default task-assign grant applied.
    expect(grants).toContainEqual({
      companyId: COMPANY_ID,
      agentId: agent.id,
      permission: "tasks:assign",
    });
  });

  it("materializes the role-specific bundle for each distinct role", async () => {
    const roles = ["cto", "qa", "sales", "support", "content"];
    const res = await post({ companyId: COMPANY_ID, roles });
    expect(res.status).toBe(200);

    // `ceo` is in here too — the CEO seed materializes its own bundle — so compare the
    // requested roles only.
    const byRole = new Map(materialized.map((m) => [m.role, m.files]));
    expect([...byRole.keys()].filter((r) => r !== "ceo").sort()).toEqual([...roles].sort());

    // Every role gets its own AGENTS.md/TOOLS.md, never the `default` fallback (which has no
    // TOOLS.md), and the shared files are shared verbatim across roles.
    const personas = roles.map((role) => {
      const files = byRole.get(role)!;
      expect(Object.keys(files).sort(), role).toEqual(["AGENTS.md", "CORE.md", "ECOSYSTEM.md", "TOOLS.md"]);
      expect(files["CORE.md"]).toBe(byRole.get("cto")!["CORE.md"]);
      expect(files["ECOSYSTEM.md"]).toBe(byRole.get("cto")!["ECOSYSTEM.md"]);
      return files["AGENTS.md"];
    });
    expect(new Set(personas).size).toBe(roles.length);
  });

  it("provisions the agency roles with their titles and persona bundles", async () => {
    const expected = [
      { role: "sales", title: "Sales Lead", name: "Sales" },
      { role: "support", title: "Customer Success Lead", name: "Support" },
      { role: "content", title: "Content Lead", name: "Content" },
    ];

    const res = await post({ companyId: COMPANY_ID, roles: expected.map((e) => e.role) });
    expect(res.status).toBe(200);
    expect(res.body.agents.map((a: { role: string; created: boolean }) => [a.role, a.created])).toEqual(
      expected.map((e) => [e.role, true]),
    );

    for (const { role, title, name } of expected) {
      const entry = res.body.agents.find((a: { role: string }) => a.role === role)!;
      const agent = store.agents.find((a) => a.id === entry.agentId)!;
      expect(agent, role).toMatchObject({ role, title, name });
      expect(agent.metadata, role).toMatchObject({ orbit_bootstrap_specialist: role });
      expect(agent.permissions, role).toEqual({ canCreateAgents: false });

      // The role's own persona bundle materialized — its AGENTS.md names the role's brief.
      const bundle = materialized.find((m) => m.agentId === agent.id)!;
      expect(Object.keys(bundle.files).sort(), role).toEqual([
        "AGENTS.md",
        "CORE.md",
        "ECOSYSTEM.md",
        "TOOLS.md",
      ]);
      expect(bundle.files["AGENTS.md"], role).toContain(title);
      expect(bundle.files["TOOLS.md"].length, role).toBeGreaterThan(0);

      expect(grants).toContainEqual({
        companyId: COMPANY_ID,
        agentId: agent.id,
        permission: "tasks:assign",
      });
    }
  });

  it("does not grant specialists CEO powers", async () => {
    const res = await post({ companyId: COMPANY_ID, roles: ["cto", "engineer", "general"] });
    expect(res.status).toBe(200);

    for (const entry of res.body.agents) {
      const agent = store.agents.find((a) => a.id === entry.agentId)!;
      expect(agent.role).not.toBe("ceo");
      expect(agent.permissions).toEqual({ canCreateAgents: false });
    }

    // The only agent with canCreateAgents in the company is the seeded CEO.
    const privileged = store.agents.filter(
      (a) => a.companyId === COMPANY_ID && a.permissions.canCreateAgents === true,
    );
    expect(privileged.map((a) => a.role)).toEqual(["ceo"]);
  });

  it("provisions a multi-role batch in one call, de-duplicating repeats", async () => {
    const res = await post({
      companyId: COMPANY_ID,
      roles: ["cto", "engineer", "qa", "engineer"],
    });

    expect(res.status).toBe(200);
    expect(res.body.agents.map((a: { role: string }) => a.role)).toEqual(["cto", "engineer", "qa"]);
    expect(res.body.agents.every((a: { created: boolean }) => a.created)).toBe(true);

    expect(specialistsOf().map((a) => a.role).sort()).toEqual(["cto", "engineer", "qa"]);
    expect(materialized.filter((m) => m.role === "engineer")).toHaveLength(1);
  });

  it("parents specialists under the company CEO, seeding one if absent", async () => {
    const res = await post({ companyId: COMPANY_ID, roles: ["engineer"] });
    expect(res.status).toBe(200);

    const ceos = store.agents.filter((a) => a.companyId === COMPANY_ID && a.role === "ceo");
    expect(ceos).toHaveLength(1);
    expect(store.agents.find((a) => a.id === res.body.agents[0].agentId)!.reportsTo).toBe(ceos[0]!.id);
  });

  // -------------------------------------------------------------------------
  // Idempotency
  // -------------------------------------------------------------------------

  it("is idempotent: a second identical call creates nothing and returns the same roster", async () => {
    const body = { companyId: COMPANY_ID, roles: ["cto", "engineer"] };

    const first = await post(body);
    const materializedAfterFirst = materialized.length;
    const grantsAfterFirst = grants.length;
    const second = await post(body);

    expect([first.status, second.status]).toEqual([200, 200]);
    expect(first.body.agents.every((a: { created: boolean }) => a.created)).toBe(true);
    expect(second.body.agents).toEqual(
      first.body.agents.map((a: { role: string; agentId: string }) => ({
        role: a.role,
        agentId: a.agentId,
        created: false,
      })),
    );

    // No duplicate agents, no re-materialization, no re-grant.
    expect(specialistsOf().map((a) => a.role).sort()).toEqual(["cto", "engineer"]);
    expect(store.agents.filter((a) => a.companyId === COMPANY_ID && a.role === "ceo")).toHaveLength(1);
    expect(materialized).toHaveLength(materializedAfterFirst);
    expect(grants).toHaveLength(grantsAfterFirst);
  });

  it("adds only the missing roles when the roster is extended", async () => {
    await post({ companyId: COMPANY_ID, roles: ["cto"] });
    const res = await post({ companyId: COMPANY_ID, roles: ["cto", "qa"] });

    expect(res.status).toBe(200);
    expect(res.body.agents).toEqual([
      { role: "cto", agentId: expect.any(String), created: false },
      { role: "qa", agentId: expect.any(String), created: true },
    ]);
    expect(specialistsOf().map((a) => a.role).sort()).toEqual(["cto", "qa"]);
  });

  it("reuses a pre-existing agent of the role rather than creating a second one", async () => {
    store.companies.push({ id: COMPANY_ID, name: "Existing Co" });
    const existing: FakeAgent = {
      id: "agent-preexisting",
      companyId: COMPANY_ID,
      name: "Hand-made Engineer",
      role: "engineer",
      title: "Engineer",
      adapterType: "codex_local",
      adapterConfig: {},
      runtimeConfig: {},
      status: "idle",
      reportsTo: null,
      permissions: { canCreateAgents: false },
      metadata: null,
    };
    store.agents.push(existing);

    const res = await post({ companyId: COMPANY_ID, roles: ["engineer"] });

    expect(res.status).toBe(200);
    expect(res.body.agents).toEqual([
      { role: "engineer", agentId: existing.id, created: false },
    ]);
    // Untouched: no bundle re-materialized for it, name and parent left alone.
    expect(materialized.some((m) => m.agentId === existing.id)).toBe(false);
    expect(existing.name).toBe("Hand-made Engineer");
    expect(existing.reportsTo).toBeNull();
    expect(specialistsOf()).toHaveLength(1);
  });

  it("does not re-create the company row when it already exists", async () => {
    store.companies.push({ id: COMPANY_ID, name: "Existing Co" });
    const res = await post({ companyId: COMPANY_ID, roles: ["engineer"] });

    expect(res.status).toBe(200);
    expect(store.companies).toHaveLength(1);
    expect(store.companies[0]!.name).toBe("Existing Co");
  });
});
