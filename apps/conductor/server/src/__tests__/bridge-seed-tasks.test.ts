import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The route reaches the DB only through domain services; mock those so the test drives the real
// route logic — auth, validation, CEO resolution, todo filing, wakeups — against in-memory state.
interface FakeIssue {
  id: string;
  companyId: string;
  identifier: string;
  title: string;
  description?: string;
  priority: string;
  status: string;
  assigneeAgentId: string | null;
  createdByAgentId: string;
}

const store: {
  companies: string[];
  ceos: Map<string, string>;
  issues: FakeIssue[];
  nextId: number;
  failCreateAt: number | null;
  bootstrapError: Error | null;
} = {
  companies: [],
  ceos: new Map(),
  issues: [],
  nextId: 1,
  failCreateAt: null,
  bootstrapError: null,
};

const mocks = vi.hoisted(() => ({
  wakeup: vi.fn(async () => ({ id: "wakeup-run" })),
  bootstrapCompanyAgents: vi.fn(),
  queueIssueAssignmentWakeup: vi.fn(),
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
    getById: async (id: string) => (store.companies.includes(id) ? { id, name: "Co" } : null),
    create: async (data: { id: string; name: string }) => {
      store.companies.push(data.id);
      return { id: data.id, name: data.name };
    },
  }),
}));

vi.mock("../services/onboarding-bootstrap.js", () => ({
  bootstrapCompanyAgents: mocks.bootstrapCompanyAgents,
}));

vi.mock("../services/issues.js", () => ({
  issueService: () => ({
    create: async (companyId: string, data: Omit<FakeIssue, "id" | "companyId" | "identifier">) => {
      if (store.failCreateAt !== null && store.issues.length === store.failCreateAt) {
        throw new Error("issue insert failed");
      }
      const n = store.nextId++;
      const row: FakeIssue = { ...data, id: `issue-${n}`, companyId, identifier: `CO-${n}` };
      store.issues.push(row);
      return row;
    },
  }),
}));

vi.mock("../services/heartbeat.js", () => ({
  heartbeatService: () => ({ wakeup: mocks.wakeup }),
}));

// Spy on the wakeup helper but keep its real behavior (it no-ops on backlog / unassigned).
vi.mock("../services/issue-assignment-wakeup.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/issue-assignment-wakeup.js")>();
  mocks.queueIssueAssignmentWakeup.mockImplementation(actual.queueIssueAssignmentWakeup);
  return { queueIssueAssignmentWakeup: mocks.queueIssueAssignmentWakeup };
});

import { bridgeSeedTasksRoutes } from "../routes/bridge-seed-tasks.js";

const BRIDGE_SECRET = "bridge-secret-for-tests-0123456789";
const SECRET_HEADER = "x-orbit-bridge-secret";
const ENDPOINT = "/api/bridge/seed-tasks";
const COMPANY_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const EXISTING_CEO = "agent-ceo-existing";

const originalSecret = process.env.ORBIT_BRIDGE_SECRET;

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(bridgeSeedTasksRoutes({} as unknown as Parameters<typeof bridgeSeedTasksRoutes>[0]));
  return app;
}

function post(body: unknown, secret: string | null = BRIDGE_SECRET) {
  const req = request(createApp()).post(ENDPOINT);
  if (secret !== null) req.set(SECRET_HEADER, secret);
  return req.send(body as object);
}

beforeEach(() => {
  store.companies = [];
  store.ceos = new Map();
  store.issues = [];
  store.nextId = 1;
  store.failCreateAt = null;
  store.bootstrapError = null;
  mocks.wakeup.mockClear();
  mocks.queueIssueAssignmentWakeup.mockClear();
  // Idempotent CEO seed: returns the existing CEO, or "creates" one.
  mocks.bootstrapCompanyAgents.mockReset();
  mocks.bootstrapCompanyAgents.mockImplementation(async (_db: unknown, companyId: string) => {
    if (store.bootstrapError) throw store.bootstrapError;
    const existing = store.ceos.get(companyId);
    if (existing) return { ceoId: existing, created: false };
    const ceoId = `agent-ceo-seeded-${companyId.slice(0, 4)}`;
    store.ceos.set(companyId, ceoId);
    return { ceoId, created: true };
  });
  process.env.ORBIT_BRIDGE_SECRET = BRIDGE_SECRET;
});

afterEach(() => {
  if (originalSecret === undefined) delete process.env.ORBIT_BRIDGE_SECRET;
  else process.env.ORBIT_BRIDGE_SECRET = originalSecret;
});

describe.sequential("bridge seed-tasks", () => {
  // -------------------------------------------------------------------------
  // Auth
  // -------------------------------------------------------------------------

  it("returns 401 for a missing or wrong secret and files nothing", async () => {
    for (const secret of [null, "wrong"]) {
      const res = await post({ companyId: COMPANY_ID, tasks: [{ title: "Kickoff" }] }, secret);
      expect(res.status, String(secret)).toBe(401);
    }
    expect(store.issues).toHaveLength(0);
    expect(store.companies).toHaveLength(0);
    expect(mocks.wakeup).not.toHaveBeenCalled();
  });

  it("returns 503 when no shared secret is configured", async () => {
    delete process.env.ORBIT_BRIDGE_SECRET;
    const res = await post({ companyId: COMPANY_ID, tasks: [{ title: "Kickoff" }] });
    expect(res.status).toBe(503);
    expect(store.issues).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------

  it("returns 400 for malformed bodies", async () => {
    const tooMany = Array.from({ length: 21 }, (_, i) => ({ title: `Task ${i}` }));
    const malformed = [
      {},
      { companyId: COMPANY_ID },
      { companyId: COMPANY_ID, tasks: [] },
      { companyId: COMPANY_ID, tasks: "Kickoff" },
      { companyId: COMPANY_ID, tasks: ["Kickoff"] },
      { companyId: COMPANY_ID, tasks: [{}] },
      { companyId: COMPANY_ID, tasks: [{ title: "" }] },
      { companyId: COMPANY_ID, tasks: [{ title: "   " }] },
      { companyId: COMPANY_ID, tasks: [{ title: "Ok" }, { title: 42 }] },
      { companyId: COMPANY_ID, tasks: [{ title: "Ok", priority: "urgent" }] },
      { companyId: COMPANY_ID, tasks: [{ title: "Ok", description: 7 }] },
      { companyId: COMPANY_ID, tasks: tooMany },
      { companyId: "not-a-uuid", tasks: [{ title: "Kickoff" }] },
      { companyId: "", tasks: [{ title: "Kickoff" }] },
      { tasks: [{ title: "Kickoff" }] },
    ];
    for (const body of malformed) {
      const res = await post(body);
      expect(res.status, JSON.stringify(body).slice(0, 120)).toBe(400);
    }
    expect(store.issues).toHaveLength(0);
    expect(mocks.bootstrapCompanyAgents).not.toHaveBeenCalled();
    expect(mocks.wakeup).not.toHaveBeenCalled();
  });

  it("accepts exactly 20 tasks", async () => {
    store.ceos.set(COMPANY_ID, EXISTING_CEO);
    const tasks = Array.from({ length: 20 }, (_, i) => ({ title: `Task ${i}` }));
    const res = await post({ companyId: COMPANY_ID, tasks });
    expect(res.status).toBe(200);
    expect(res.body.issues).toHaveLength(20);
  });

  // -------------------------------------------------------------------------
  // Filing
  // -------------------------------------------------------------------------

  it("files a todo issue assigned to (and created by) the CEO and wakes the CEO", async () => {
    store.companies.push(COMPANY_ID);
    store.ceos.set(COMPANY_ID, EXISTING_CEO);

    const res = await post({
      companyId: COMPANY_ID,
      tasks: [{ title: "  Kickoff  ", description: "  Meet the team  ", priority: "high" }],
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ issues: [{ id: "issue-1", identifier: "CO-1", title: "Kickoff" }] });

    expect(store.issues).toHaveLength(1);
    const issue = store.issues[0]!;
    expect(issue).toMatchObject({
      companyId: COMPANY_ID,
      title: "Kickoff",
      description: "Meet the team",
      priority: "high",
      status: "todo",
      assigneeAgentId: EXISTING_CEO,
      createdByAgentId: EXISTING_CEO,
    });

    expect(mocks.queueIssueAssignmentWakeup).toHaveBeenCalledTimes(1);
    expect(mocks.queueIssueAssignmentWakeup.mock.calls[0]![0]).toMatchObject({
      issue: { id: "issue-1", assigneeAgentId: EXISTING_CEO, status: "todo" },
      mutation: "create",
    });
    expect(mocks.wakeup).toHaveBeenCalledTimes(1);
    expect(mocks.wakeup).toHaveBeenCalledWith(
      EXISTING_CEO,
      expect.objectContaining({ source: "assignment", payload: { issueId: "issue-1", mutation: "create" } }),
    );
  });

  it("defaults priority to medium and omits an empty description", async () => {
    store.ceos.set(COMPANY_ID, EXISTING_CEO);
    const res = await post({ companyId: COMPANY_ID, tasks: [{ title: "Kickoff", description: "   " }] });
    expect(res.status).toBe(200);
    expect(store.issues[0]!.priority).toBe("medium");
    expect(store.issues[0]!).not.toHaveProperty("description");
  });

  it("files a multi-task batch, resolving the CEO once and waking it per issue", async () => {
    store.ceos.set(COMPANY_ID, EXISTING_CEO);
    const res = await post({
      companyId: COMPANY_ID,
      tasks: [
        { title: "Set up brand kit", priority: "critical" },
        { title: "Draft first campaign" },
        { title: "Review CRM import", priority: "low" },
      ],
    });

    expect(res.status).toBe(200);
    expect(res.body.issues.map((i: { title: string }) => i.title)).toEqual([
      "Set up brand kit",
      "Draft first campaign",
      "Review CRM import",
    ]);
    expect(store.issues.map((i) => i.priority)).toEqual(["critical", "medium", "low"]);
    expect(store.issues.every((i) => i.status === "todo" && i.assigneeAgentId === EXISTING_CEO)).toBe(true);

    expect(mocks.bootstrapCompanyAgents).toHaveBeenCalledTimes(1);
    expect(mocks.wakeup).toHaveBeenCalledTimes(3);
    expect(mocks.wakeup.mock.calls.map((c) => (c as unknown[])[0])).toEqual([
      EXISTING_CEO,
      EXISTING_CEO,
      EXISTING_CEO,
    ]);
  });

  it("seeds the company and its CEO when both are missing, then assigns to the new CEO", async () => {
    const res = await post({ companyId: COMPANY_ID, tasks: [{ title: "Kickoff" }] });

    expect(res.status).toBe(200);
    expect(store.companies).toContain(COMPANY_ID);
    const seededCeo = store.ceos.get(COMPANY_ID)!;
    expect(seededCeo).toBeTruthy();
    await expect(mocks.bootstrapCompanyAgents.mock.results[0]!.value).resolves.toMatchObject({ created: true });
    expect(store.issues[0]!).toMatchObject({ status: "todo", assigneeAgentId: seededCeo });
    expect(mocks.wakeup).toHaveBeenCalledWith(seededCeo, expect.anything());
  });

  // -------------------------------------------------------------------------
  // Failures are surfaced, never silent
  // -------------------------------------------------------------------------

  it("returns 500 with a clear error when the CEO cannot be resolved, filing nothing", async () => {
    store.bootstrapError = new Error("agent insert failed");
    const res = await post({ companyId: COMPANY_ID, tasks: [{ title: "Kickoff" }] });

    expect(res.status).toBe(500);
    expect(res.body.error).toContain("could not resolve CEO");
    expect(res.body.error).toContain("agent insert failed");
    expect(store.issues).toHaveLength(0);
    expect(mocks.wakeup).not.toHaveBeenCalled();
  });

  it("surfaces a mid-batch failure with the failing index and the issues already filed", async () => {
    store.ceos.set(COMPANY_ID, EXISTING_CEO);
    store.failCreateAt = 1;
    const res = await post({
      companyId: COMPANY_ID,
      tasks: [{ title: "First" }, { title: "Second" }, { title: "Third" }],
    });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: "issue insert failed",
      failedTaskIndex: 1,
      issues: [{ id: "issue-1", identifier: "CO-1", title: "First" }],
    });
    expect(store.issues).toHaveLength(1);
    expect(mocks.wakeup).toHaveBeenCalledTimes(1);
  });

  it("surfaces a wakeup failure rather than reporting success", async () => {
    store.ceos.set(COMPANY_ID, EXISTING_CEO);
    mocks.wakeup.mockRejectedValueOnce(new Error("wakeup queue down"));
    const res = await post({ companyId: COMPANY_ID, tasks: [{ title: "First" }, { title: "Second" }] });

    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({
      error: "wakeup queue down",
      failedTaskIndex: 0,
      issues: [{ id: "issue-1", identifier: "CO-1", title: "First" }],
    });
    expect(store.issues).toHaveLength(1);
  });
});
