import { createHmac } from "node:crypto";
import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("drizzle-orm", () => ({
  eq: (col: { __col?: string } | unknown, value: unknown) => {
    const colName = (col as { __col?: string })?.__col;
    return { __op: "eq", __col: colName, __value: value };
  },
  and: (...clauses: unknown[]) => ({ __op: "and", __clauses: clauses }),
}));
vi.mock("@paperclipai/db", () => ({
  authUsers: { __name: "user", email: { __col: "email" }, id: { __col: "id" } },
  authSessions: { __name: "session" },
  companies: { __name: "company", id: { __col: "id" } },
  companyMemberships: {
    __name: "membership",
    id: { __col: "id" },
    companyId: { __col: "companyId" },
    principalType: { __col: "principalType" },
    principalId: { __col: "principalId" },
  },
  appAccess: {
    __name: "app_access",
    companyId: { __col: "companyId" },
    app: { __col: "app" },
    enabled: { __col: "enabled" },
  },
}));

// The company-creation path goes through the `companyService.create` chokepoint (issue-prefix
// allocation + ensureLocalEnvironment + CEO seed). Mocked so these stay unit tests: the real
// service would pull in onboarding-bootstrap/environments and hit the (absent) DB.
const companyServiceCreate = vi.hoisted(() => vi.fn());
vi.mock("../services/companies.js", () => ({
  companyService: () => ({ create: companyServiceCreate }),
}));

// Per-company WorkPipe config (Gate 4): the new-org path resolves the workpipe-tools plugin's
// DB uuid by `plugins.plugin_key` and writes { portalOrgId } into plugin_company_settings.
// Both services are mocked so these stay unit tests (the real ones hit the absent DB).
const getPluginByKey = vi.hoisted(() => vi.fn());
vi.mock("../services/plugin-registry.js", () => ({
  pluginRegistryService: () => ({ getByKey: getPluginByKey }),
}));
const pluginSettingsUpsert = vi.hoisted(() => vi.fn());
const pluginSettingsGet = vi.hoisted(() => vi.fn());
vi.mock("../services/plugin-company-settings.js", () => ({
  pluginCompanySettingsService: () => ({
    get: pluginSettingsGet,
    upsert: pluginSettingsUpsert,
  }),
}));

// Plugin key == the workpipe-tools manifest id; the uuid is the `plugins.id` row value.
const WORKPIPE_PLUGIN_KEY = "orbit.workpipe-tools";
const WORKPIPE_PLUGIN_DB_ID = "9f6f0a4e-1c2b-4d3e-8a5f-0b1c2d3e4f50";

import { errorHandler } from "../middleware/index.js";
import { logger } from "../middleware/logger.js";
import {
  isSafeRedirectTarget,
  portalCallbackRoutes,
  resolvePortalCompany,
  uuidV5,
  PORTAL_ORG_UUID_NAMESPACE,
} from "../routes/portal-callback.js";

const PORTAL_SECRET = "portal-secret-for-tests";
const COOKIE_SECRET = "cookie-secret-for-tests";
const COOKIE_NAME_PREFIX = "paperclip-default";

const originalEnv = {
  portalSecret: process.env.ORBIT_PORTAL_JWT_SECRET,
  betterAuthSecret: process.env.BETTER_AUTH_SECRET,
  paperclipAgentSecret: process.env.PAPERCLIP_AGENT_JWT_SECRET,
  instanceId: process.env.PAPERCLIP_INSTANCE_ID,
  companyOverrides: process.env.PORTAL_COMPANY_OVERRIDES,
};

beforeEach(() => {
  process.env.ORBIT_PORTAL_JWT_SECRET = PORTAL_SECRET;
  process.env.BETTER_AUTH_SECRET = COOKIE_SECRET;
  delete process.env.PAPERCLIP_AGENT_JWT_SECRET;
  delete process.env.PAPERCLIP_INSTANCE_ID;
  delete process.env.PORTAL_COMPANY_OVERRIDES;
});

afterEach(() => {
  if (originalEnv.portalSecret === undefined) delete process.env.ORBIT_PORTAL_JWT_SECRET;
  else process.env.ORBIT_PORTAL_JWT_SECRET = originalEnv.portalSecret;
  if (originalEnv.betterAuthSecret === undefined) delete process.env.BETTER_AUTH_SECRET;
  else process.env.BETTER_AUTH_SECRET = originalEnv.betterAuthSecret;
  if (originalEnv.paperclipAgentSecret === undefined) delete process.env.PAPERCLIP_AGENT_JWT_SECRET;
  else process.env.PAPERCLIP_AGENT_JWT_SECRET = originalEnv.paperclipAgentSecret;
  if (originalEnv.instanceId === undefined) delete process.env.PAPERCLIP_INSTANCE_ID;
  else process.env.PAPERCLIP_INSTANCE_ID = originalEnv.instanceId;
  if (originalEnv.companyOverrides === undefined) delete process.env.PORTAL_COMPANY_OVERRIDES;
  else process.env.PORTAL_COMPANY_OVERRIDES = originalEnv.companyOverrides;
});

function base64Url(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

interface PortalClaimsInput {
  sub?: string;
  email?: string;
  name?: string;
  app_access?: string[];
  iat?: number;
  exp?: number;
  org_id?: string;
  org_name?: string;
  org_slug?: string;
}

function makePortalJwt(claims: PortalClaimsInput, opts?: { secret?: string; alg?: string }): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: opts?.alg ?? "HS256", typ: "JWT" };
  const payload: Record<string, unknown> = {
    sub: claims.sub ?? "portal-user-1",
    email: claims.email ?? "operator@example.com",
    name: claims.name,
    app_access: claims.app_access ?? ["CONDUCTOR"],
    iat: claims.iat ?? now,
    exp: claims.exp ?? now + 60,
  };
  if (claims.org_id !== undefined) payload.org_id = claims.org_id;
  if (claims.org_name !== undefined) payload.org_name = claims.org_name;
  if (claims.org_slug !== undefined) payload.org_slug = claims.org_slug;
  const signingInput = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`;
  const signature = createHmac("sha256", opts?.secret ?? PORTAL_SECRET)
    .update(signingInput)
    .digest("base64url");
  return `${signingInput}.${signature}`;
}

interface FakeUserRow {
  id: string;
  email: string;
  name: string;
}

interface FakeCompanyRow {
  id: string;
  name: string;
}

interface FakeMembershipRow {
  id: string;
  companyId: string;
  principalType: string;
  principalId: string;
  status: string;
  membershipRole: string | null;
}

interface FakeAppAccessRow {
  companyId: string;
  app: string;
  enabled: boolean;
}

interface FakeDbState {
  users: FakeUserRow[];
  sessions: { id: string; token: string; userId: string }[];
  companies: FakeCompanyRow[];
  memberships: FakeMembershipRow[];
  appAccess: FakeAppAccessRow[];
  userInsertCount: number;
  companyInsertCount: number;
  membershipInsertCount: number;
}

interface EqClause {
  __op: "eq";
  __col?: string;
  __value: unknown;
}

interface AndClause {
  __op: "and";
  __clauses: unknown[];
}

function evalClause(row: Record<string, unknown>, clause: unknown): boolean {
  if (!clause || typeof clause !== "object") return true;
  const c = clause as Partial<EqClause & AndClause>;
  if (c.__op === "and" && Array.isArray(c.__clauses)) {
    return c.__clauses.every((sub) => evalClause(row, sub));
  }
  if (c.__op === "eq" && c.__col) {
    return row[c.__col] === c.__value;
  }
  return true;
}

function createFakeDb(initial?: {
  users?: FakeUserRow[];
  companies?: FakeCompanyRow[];
  memberships?: FakeMembershipRow[];
  appAccess?: FakeAppAccessRow[];
}) {
  const state: FakeDbState = {
    users: [...(initial?.users ?? [])],
    sessions: [],
    companies: [...(initial?.companies ?? [])],
    memberships: [...(initial?.memberships ?? [])],
    appAccess: [...(initial?.appAccess ?? [])],
    userInsertCount: 0,
    companyInsertCount: 0,
    membershipInsertCount: 0,
  };

  let membershipIdCounter = state.memberships.length;

  function tableRows(name: string): Record<string, unknown>[] {
    if (name === "user") return state.users as unknown as Record<string, unknown>[];
    if (name === "company") return state.companies as unknown as Record<string, unknown>[];
    if (name === "membership")
      return state.memberships as unknown as Record<string, unknown>[];
    if (name === "app_access")
      return state.appAccess as unknown as Record<string, unknown>[];
    return [];
  }

  const db = {
    select(projection?: Record<string, { __col?: string }>) {
      return {
        from(table: { __name: string }) {
          return {
            where(predicate: unknown) {
              const rows = tableRows(table.__name).filter((row) => evalClause(row, predicate));
              const projected = rows.map((row) => {
                if (!projection) return row;
                const out: Record<string, unknown> = {};
                for (const [outKey, col] of Object.entries(projection)) {
                  const sourceKey = col?.__col;
                  out[outKey] = sourceKey ? row[sourceKey] : undefined;
                }
                return out;
              });
              return Promise.resolve(projected);
            },
          };
        },
      };
    },
    insert(table: { __name: string }) {
      return {
        values(row: Record<string, unknown>) {
          // app_access is always written via reconcileAppAccess' upsert, i.e.
          // .values(row).onConflictDoUpdate(...). Model the (companyId, app) unique
          // upsert here; the returned object exposes onConflictDoUpdate.
          if (table.__name === "app_access") {
            const applyUpsert = () => {
              const companyId = String(row.companyId);
              const app = String(row.app);
              const enabled = Boolean(row.enabled);
              const existing = state.appAccess.find(
                (r) => r.companyId === companyId && r.app === app,
              );
              if (existing) existing.enabled = enabled;
              else state.appAccess.push({ companyId, app, enabled });
            };
            return {
              onConflictDoUpdate() {
                applyUpsert();
                return Promise.resolve();
              },
            };
          }
          if (table.__name === "user") {
            state.userInsertCount += 1;
            state.users.push({
              id: String(row.id),
              email: String(row.email),
              name: String(row.name),
            });
          } else if (table.__name === "session") {
            state.sessions.push({
              id: String(row.id),
              token: String(row.token),
              userId: String(row.userId),
            });
          } else if (table.__name === "company") {
            state.companyInsertCount += 1;
            state.companies.push({
              id: String(row.id),
              name: String(row.name),
            });
          } else if (table.__name === "membership") {
            state.membershipInsertCount += 1;
            membershipIdCounter += 1;
            state.memberships.push({
              id: `mem-${membershipIdCounter}`,
              companyId: String(row.companyId),
              principalType: String(row.principalType),
              principalId: String(row.principalId),
              status: String(row.status),
              membershipRole:
                row.membershipRole === null || row.membershipRole === undefined
                  ? null
                  : String(row.membershipRole),
            });
          }
          return Promise.resolve();
        },
      };
    },
  };

  // Stand-in for the real chokepoint: records the insert against the same fake state the raw
  // insert used to touch (so the existing company assertions still hold) and returns the
  // ENRICHED shape `companyService.create` resolves with (row + issuePrefix + logoUrl).
  getPluginByKey.mockReset();
  getPluginByKey.mockResolvedValue({ id: WORKPIPE_PLUGIN_DB_ID, pluginKey: WORKPIPE_PLUGIN_KEY });
  pluginSettingsUpsert.mockReset();
  pluginSettingsUpsert.mockResolvedValue({ companyId: "", pluginId: WORKPIPE_PLUGIN_DB_ID });
  pluginSettingsGet.mockReset();
  pluginSettingsGet.mockResolvedValue(null);

  companyServiceCreate.mockReset();
  companyServiceCreate.mockImplementation(async (data: { id: string; name: string }) => {
    state.companyInsertCount += 1;
    state.companies.push({ id: data.id, name: data.name });
    return {
      id: data.id,
      name: data.name,
      description: null,
      status: "active",
      issuePrefix: data.name.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3) || "CMP",
      issueCounter: 0,
      logoAssetId: null,
      logoUrl: null,
    };
  });

  return { db: db as unknown as Parameters<typeof portalCallbackRoutes>[0], state };
}

// Shape of the primary-key unique violation node-postgres raises when a concurrent first-login
// wins the create race. createCompanyWithUniquePrefix only retries `companies_issue_prefix_idx`
// and RETHROWS this one.
function companyPkUniqueViolation(): Error & { code: string; constraint: string } {
  const err = new Error(
    'duplicate key value violates unique constraint "companies_pkey"',
  ) as Error & { code: string; constraint: string };
  err.code = "23505";
  err.constraint = "companies_pkey";
  return err;
}

const DEFAULT_PORTAL_COMPANY_ID = "00000000-0000-4000-a000-000000000001";

function createApp(db: Parameters<typeof portalCallbackRoutes>[0]) {
  const app = express();
  app.use(portalCallbackRoutes(db));
  app.use(errorHandler);
  return app;
}

describe.sequential("portal-callback route", () => {
  it("provisions a new user and sets a signed session cookie on valid CONDUCTOR JWT", async () => {
    const { db, state } = createFakeDb();
    const app = createApp(db);
    const token = makePortalJwt({ email: "new-user@example.com", name: "New User" });

    const res = await request(app).get("/conductor/auth/callback").query({ token });

    expect(res.status).toBe(302);
    expect(res.header.location).toBe("/");
    expect(state.userInsertCount).toBe(1);
    expect(state.sessions).toHaveLength(1);
    expect(state.sessions[0].userId).toBe(state.users[0].id);
    expect(state.users[0].email).toBe("new-user@example.com");

    const cookieHeader = res.header["set-cookie"];
    expect(Array.isArray(cookieHeader)).toBe(true);
    const cookie = (cookieHeader as string[])[0];
    expect(cookie).toContain(`${COOKIE_NAME_PREFIX}.session_token=`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
  });

  it("returns 403 when CONDUCTOR is missing from app_access (regression: JWT-claim gate kept)", async () => {
    const { db, state } = createFakeDb();
    const app = createApp(db);
    const token = makePortalJwt({ app_access: ["ATRIUM", "WORKPIPE"] });

    const res = await request(app).get("/conductor/auth/callback").query({ token });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("entitlement_denied");
    expect(state.sessions).toHaveLength(0);
    expect(state.users).toHaveLength(0);
    // Layer-1 gate rejects before any provisioning: no company and no app_access rows
    // are written for a denied login.
    expect(state.companies).toHaveLength(0);
    expect(state.appAccess).toHaveLength(0);
  });

  it("persists the CONDUCTOR entitlement into app_access on launch (upsert-on-launch)", async () => {
    const { db, state } = createFakeDb();
    const app = createApp(db);
    const org = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
    const token = makePortalJwt({
      email: "launch@example.com",
      org_id: org,
      app_access: ["CONDUCTOR", "ATRIUM"],
    });

    const res = await request(app).get("/conductor/auth/callback").query({ token });

    expect(res.status).toBe(302);
    // Every app present in the claim is persisted as enabled=true for the company.
    const rows = state.appAccess.filter((r) => r.companyId === org);
    expect(rows.find((r) => r.app === "CONDUCTOR")).toEqual({
      companyId: org,
      app: "CONDUCTOR",
      enabled: true,
    });
    expect(rows.find((r) => r.app === "ATRIUM")).toEqual({
      companyId: org,
      app: "ATRIUM",
      enabled: true,
    });
  });

  it("returns 403 for expired JWTs", async () => {
    const { db, state } = createFakeDb();
    const app = createApp(db);
    const past = Math.floor(Date.now() / 1000) - 120;
    const token = makePortalJwt({ iat: past - 60, exp: past });

    const res = await request(app).get("/conductor/auth/callback").query({ token });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("expired");
    expect(state.sessions).toHaveLength(0);
  });

  it("returns 403 for a JWT signed with the wrong secret", async () => {
    const { db, state } = createFakeDb();
    const app = createApp(db);
    const token = makePortalJwt({}, { secret: "wrong-secret" });

    const res = await request(app).get("/conductor/auth/callback").query({ token });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("bad_signature");
    expect(state.sessions).toHaveLength(0);
  });

  it("returns 400 when token query param is missing", async () => {
    const { db, state } = createFakeDb();
    const app = createApp(db);

    const res = await request(app).get("/conductor/auth/callback");

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("missing_token");
    expect(state.sessions).toHaveLength(0);
  });

  it("falls back to / for open-redirect attempts (protocol-relative, absolute URL, path traversal)", async () => {
    const { db } = createFakeDb();
    const app = createApp(db);
    const token = makePortalJwt({});
    const hostileTargets = [
      "//evil.com/path",
      "https://evil.com",
      "http://evil.com",
      "\\\\evil.com",
      "javascript:alert(1)",
      "evil.com/path",
    ];
    for (const target of hostileTargets) {
      const res = await request(app)
        .get("/conductor/auth/callback")
        .query({ token, redirect_to: target });
      expect(res.status).toBe(302);
      expect(res.header.location).toBe("/");
    }
  });

  it("honors safe relative redirect_to values", async () => {
    const { db } = createFakeDb();
    const app = createApp(db);
    const token = makePortalJwt({});

    const res = await request(app)
      .get("/conductor/auth/callback")
      .query({ token, redirect_to: "/projects/42?tab=tasks" });

    expect(res.status).toBe(302);
    expect(res.header.location).toBe("/projects/42?tab=tasks");
  });

  it("reuses the existing user row for returning users (no duplicate insert)", async () => {
    const { db, state } = createFakeDb({
      users: [{ id: "existing-user-1", email: "returning@example.com", name: "Returning" }],
    });
    const app = createApp(db);
    const token = makePortalJwt({ email: "returning@example.com" });

    const res = await request(app).get("/conductor/auth/callback").query({ token });

    expect(res.status).toBe(302);
    expect(state.userInsertCount).toBe(0);
    expect(state.users).toHaveLength(1);
    expect(state.sessions).toHaveLength(1);
    expect(state.sessions[0].userId).toBe("existing-user-1");
  });

  it("new user with no org_id: creates default portal company + membership", async () => {
    const { db, state } = createFakeDb();
    const app = createApp(db);
    const token = makePortalJwt({ email: "fresh@example.com" });

    const res = await request(app).get("/conductor/auth/callback").query({ token });

    expect(res.status).toBe(302);
    expect(state.userInsertCount).toBe(1);
    expect(state.companyInsertCount).toBe(1);
    expect(state.companies[0]).toEqual({
      id: DEFAULT_PORTAL_COMPANY_ID,
      name: "Orbit Portal Users",
    });
    expect(state.membershipInsertCount).toBe(1);
    expect(state.memberships[0]).toMatchObject({
      companyId: DEFAULT_PORTAL_COMPANY_ID,
      principalType: "user",
      principalId: state.users[0].id,
      status: "active",
      membershipRole: "operator",
    });
  });

  it("new user, default company already exists: no duplicate company, membership created", async () => {
    const { db, state } = createFakeDb({
      companies: [{ id: DEFAULT_PORTAL_COMPANY_ID, name: "Orbit Portal Users" }],
    });
    const app = createApp(db);
    const token = makePortalJwt({ email: "second@example.com" });

    const res = await request(app).get("/conductor/auth/callback").query({ token });

    expect(res.status).toBe(302);
    expect(state.companyInsertCount).toBe(0);
    expect(state.companies).toHaveLength(1);
    expect(state.userInsertCount).toBe(1);
    expect(state.membershipInsertCount).toBe(1);
    expect(state.memberships[0].principalId).toBe(state.users[0].id);
  });

  it("existing user without membership: no duplicate user, membership created", async () => {
    const { db, state } = createFakeDb({
      users: [{ id: "user-x", email: "no-membership@example.com", name: "X" }],
      companies: [{ id: DEFAULT_PORTAL_COMPANY_ID, name: "Orbit Portal Users" }],
    });
    const app = createApp(db);
    const token = makePortalJwt({ email: "no-membership@example.com" });

    const res = await request(app).get("/conductor/auth/callback").query({ token });

    expect(res.status).toBe(302);
    expect(state.userInsertCount).toBe(0);
    expect(state.companyInsertCount).toBe(0);
    expect(state.membershipInsertCount).toBe(1);
    expect(state.memberships[0].principalId).toBe("user-x");
  });

  it("existing user with existing membership: idempotent (no duplicate membership)", async () => {
    const { db, state } = createFakeDb({
      users: [{ id: "user-y", email: "already-in@example.com", name: "Y" }],
      companies: [{ id: DEFAULT_PORTAL_COMPANY_ID, name: "Orbit Portal Users" }],
      memberships: [
        {
          id: "mem-existing",
          companyId: DEFAULT_PORTAL_COMPANY_ID,
          principalType: "user",
          principalId: "user-y",
          status: "active",
          membershipRole: "operator",
        },
      ],
    });
    const app = createApp(db);
    const token = makePortalJwt({ email: "already-in@example.com" });

    const res = await request(app).get("/conductor/auth/callback").query({ token });

    expect(res.status).toBe(302);
    expect(state.userInsertCount).toBe(0);
    expect(state.companyInsertCount).toBe(0);
    expect(state.membershipInsertCount).toBe(0);
    expect(state.memberships).toHaveLength(1);
  });

  it("same email, two different org_id claims: two memberships, two companies", async () => {
    const { db, state } = createFakeDb();
    const app = createApp(db);
    const orgA = "11111111-1111-4111-a111-111111111111";
    const orgB = "22222222-2222-4222-a222-222222222222";

    const resA = await request(app)
      .get("/conductor/auth/callback")
      .query({ token: makePortalJwt({ email: "multi@example.com", org_id: orgA, org_name: "Org A" }) });
    expect(resA.status).toBe(302);

    const resB = await request(app)
      .get("/conductor/auth/callback")
      .query({ token: makePortalJwt({ email: "multi@example.com", org_id: orgB, org_name: "Org B" }) });
    expect(resB.status).toBe(302);

    expect(state.userInsertCount).toBe(1);
    expect(state.companies.map((c) => c.id).sort()).toEqual([orgA, orgB].sort());
    expect(state.companies.find((c) => c.id === orgA)?.name).toBe("Org A");
    expect(state.companies.find((c) => c.id === orgB)?.name).toBe("Org B");
    expect(state.memberships).toHaveLength(2);
    const principalIds = new Set(state.memberships.map((m) => m.principalId));
    expect(principalIds.size).toBe(1);
    const companyIds = state.memberships.map((m) => m.companyId).sort();
    expect(companyIds).toEqual([orgA, orgB].sort());
  });

  it("maps a non-UUID (CUID) org_id to a stable per-org company, not the default (#60)", async () => {
    const { db, state } = createFakeDb();
    const app = createApp(db);
    const cuid = "clv9k2x7a0001abcd1234efgh"; // Portal Organization.id shape (cuid)
    const expectedId = uuidV5(cuid, PORTAL_ORG_UUID_NAMESPACE);
    const token = makePortalJwt({ email: "cuid-org@example.com", org_id: cuid, org_slug: "acme-co" });

    const res = await request(app).get("/conductor/auth/callback").query({ token });

    expect(res.status).toBe(302);
    expect(state.companies).toHaveLength(1);
    expect(state.companies[0].id).toBe(expectedId);
    expect(state.companies[0].id).not.toBe(DEFAULT_PORTAL_COMPANY_ID);
    // Company name comes from org_slug when org_name is absent.
    expect(state.companies[0].name).toBe("acme-co");
    expect(state.memberships[0].companyId).toBe(expectedId);
  });

  it("resolves the same CUID org_id to one stable company across repeat logins (#60)", async () => {
    const { db, state } = createFakeDb();
    const app = createApp(db);
    const cuid = "clv9k2x7a0002zzzz9999wxyz";

    for (let i = 0; i < 2; i += 1) {
      const res = await request(app)
        .get("/conductor/auth/callback")
        .query({ token: makePortalJwt({ email: "stable@example.com", org_id: cuid }) });
      expect(res.status).toBe(302);
    }

    expect(state.companies).toHaveLength(1);
    expect(state.companyInsertCount).toBe(1);
    expect(state.companies[0].id).toBe(uuidV5(cuid, PORTAL_ORG_UUID_NAMESPACE));
  });

  it("two distinct CUID org_ids resolve to two distinct companies (#60)", async () => {
    const { db, state } = createFakeDb();
    const app = createApp(db);
    const cuidA = "clv9k2x7a0003aaaa1111aaaa";
    const cuidB = "clv9k2x7a0004bbbb2222bbbb";

    await request(app)
      .get("/conductor/auth/callback")
      .query({ token: makePortalJwt({ email: "a@example.com", org_id: cuidA }) });
    await request(app)
      .get("/conductor/auth/callback")
      .query({ token: makePortalJwt({ email: "b@example.com", org_id: cuidB }) });

    expect(state.companies).toHaveLength(2);
    expect(state.companies.map((c) => c.id).sort()).toEqual(
      [uuidV5(cuidA, PORTAL_ORG_UUID_NAMESPACE), uuidV5(cuidB, PORTAL_ORG_UUID_NAMESPACE)].sort(),
    );
  });

  it("honors PORTAL_COMPANY_OVERRIDES to pin a Portal org to a pre-existing company (#60)", async () => {
    const orbitCuid = "clorbit000org00000000000000";
    process.env.PORTAL_COMPANY_OVERRIDES = `${orbitCuid}=${DEFAULT_PORTAL_COMPANY_ID}`;
    const { db, state } = createFakeDb({
      companies: [{ id: DEFAULT_PORTAL_COMPANY_ID, name: "Orbit Portal Users" }],
    });
    const app = createApp(db);
    const token = makePortalJwt({ email: "orbit@example.com", org_id: orbitCuid, org_slug: "orbit" });

    const res = await request(app).get("/conductor/auth/callback").query({ token });

    expect(res.status).toBe(302);
    // Existing company reused (not duplicated, not remapped to a derived UUID).
    expect(state.companyInsertCount).toBe(0);
    expect(state.companies).toHaveLength(1);
    expect(state.companies[0].id).toBe(DEFAULT_PORTAL_COMPANY_ID);
    expect(state.memberships[0].companyId).toBe(DEFAULT_PORTAL_COMPANY_ID);
  });

  it("falls back to the default company only when org_id is entirely absent (#60)", async () => {
    const { db, state } = createFakeDb();
    const app = createApp(db);
    const token = makePortalJwt({ email: "no-org@example.com" }); // no org_id

    const res = await request(app).get("/conductor/auth/callback").query({ token });

    expect(res.status).toBe(302);
    expect(state.companies).toHaveLength(1);
    expect(state.companies[0].id).toBe(DEFAULT_PORTAL_COMPANY_ID);
  });

  it("new org first login: creates the company via companyService.create with default opts (CEO seed)", async () => {
    const { db, state } = createFakeDb();
    const app = createApp(db);
    const cuid = "clv9k2x7a0010seed0000seed0";
    const expectedId = uuidV5(cuid, PORTAL_ORG_UUID_NAMESPACE);
    const token = makePortalJwt({
      email: "seed@example.com",
      org_id: cuid,
      org_name: "Seed Co",
    });

    const res = await request(app).get("/conductor/auth/callback").query({ token });

    expect(res.status).toBe(302);
    // Routed through the chokepoint — not a raw insert — with the MAPPED company id.
    expect(companyServiceCreate).toHaveBeenCalledTimes(1);
    expect(companyServiceCreate).toHaveBeenCalledWith({ id: expectedId, name: "Seed Co" });
    // Default options: no opts arg at all, so bootstrapAgents (CEO seed), issue-prefix
    // allocation and ensureLocalEnvironment all run.
    expect(companyServiceCreate.mock.calls[0]).toHaveLength(1);

    // Downstream still completes off the enriched return value.
    expect(state.memberships).toHaveLength(1);
    expect(state.memberships[0]).toMatchObject({
      companyId: expectedId,
      principalType: "user",
      principalId: state.users[0].id,
      status: "active",
      membershipRole: "operator",
    });
    expect(state.sessions).toHaveLength(1);
    expect(state.sessions[0].userId).toBe(state.users[0].id);
    expect(state.appAccess.find((r) => r.companyId === expectedId && r.app === "CONDUCTOR")).toEqual({
      companyId: expectedId,
      app: "CONDUCTOR",
      enabled: true,
    });
  });

  it("existing org login: companyService.create is NOT called (no re-create, no re-seed)", async () => {
    const cuid = "clv9k2x7a0011exist000exist";
    const existingId = uuidV5(cuid, PORTAL_ORG_UUID_NAMESPACE);
    const { db, state } = createFakeDb({
      companies: [{ id: existingId, name: "Already Here" }],
    });
    const app = createApp(db);
    const token = makePortalJwt({ email: "existing-org@example.com", org_id: cuid, org_name: "Renamed" });

    const res = await request(app).get("/conductor/auth/callback").query({ token });

    expect(res.status).toBe(302);
    expect(companyServiceCreate).not.toHaveBeenCalled();
    expect(state.companyInsertCount).toBe(0);
    expect(state.companies).toHaveLength(1);
    // Existing row preserved verbatim — the login does not rename or re-seed it.
    expect(state.companies[0]).toEqual({ id: existingId, name: "Already Here" });
    expect(state.memberships[0].companyId).toBe(existingId);
    expect(state.sessions).toHaveLength(1);
  });

  it("lost create race: re-reads the company on a PK unique violation instead of 500ing", async () => {
    const cuid = "clv9k2x7a0012race0000race0";
    const racedId = uuidV5(cuid, PORTAL_ORG_UUID_NAMESPACE);
    const { db, state } = createFakeDb();
    const app = createApp(db);

    // The concurrent login wins: its row lands, then OUR create throws the PK violation
    // that createCompanyWithUniquePrefix rethrows (it only retries the issue_prefix index).
    companyServiceCreate.mockImplementationOnce(async (data: { id: string; name: string }) => {
      state.companyInsertCount += 1;
      state.companies.push({ id: data.id, name: data.name });
      throw companyPkUniqueViolation();
    });

    const token = makePortalJwt({ email: "race@example.com", org_id: cuid, org_name: "Race Co" });
    const res = await request(app).get("/conductor/auth/callback").query({ token });

    expect(res.status).toBe(302);
    expect(res.header.location).toBe("/");
    expect(companyServiceCreate).toHaveBeenCalledTimes(1);
    expect(state.companies).toHaveLength(1);
    expect(state.companies[0].id).toBe(racedId);
    // The login still completes off the re-read row.
    expect(state.memberships).toHaveLength(1);
    expect(state.memberships[0].companyId).toBe(racedId);
    expect(state.sessions).toHaveLength(1);
    expect(res.header["set-cookie"]).toBeDefined();
  });

  it("does not swallow a create failure when the company still does not exist", async () => {
    const { db, state } = createFakeDb();
    const app = createApp(db);
    // Create blows up for a reason that is NOT a lost race — no row appears.
    companyServiceCreate.mockRejectedValueOnce(new Error("connection terminated"));

    const token = makePortalJwt({
      email: "boom@example.com",
      org_id: "clv9k2x7a0013boom0000boom0",
    });
    const res = await request(app).get("/conductor/auth/callback").query({ token });

    expect(res.status).toBe(500);
    expect(state.companies).toHaveLength(0);
    expect(state.memberships).toHaveLength(0);
    expect(state.sessions).toHaveLength(0);
  });

  it("new org first login: persists the RAW Portal org id as the company's workpipe-tools setting", async () => {
    const cuid = "clv9k2x7a0014wpipe00wpipe0";
    const expectedId = uuidV5(cuid, PORTAL_ORG_UUID_NAMESPACE);
    const { db } = createFakeDb();
    const app = createApp(db);
    const token = makePortalJwt({ email: "wp@example.com", org_id: cuid, org_name: "WP Co" });

    const res = await request(app).get("/conductor/auth/callback").query({ token });

    expect(res.status).toBe(302);
    // Resolved by plugin key (== manifest id), not by a hard-coded uuid.
    expect(getPluginByKey).toHaveBeenCalledWith(WORKPIPE_PLUGIN_KEY);
    expect(pluginSettingsUpsert).toHaveBeenCalledTimes(1);
    expect(pluginSettingsUpsert).toHaveBeenCalledWith(expectedId, WORKPIPE_PLUGIN_DB_ID, {
      portalOrgId: cuid,
    });
    // The stored value is the Portal CUID (== WorkPipe Business.id), NOT the derived companyId.
    const [, , settings] = pluginSettingsUpsert.mock.calls[0];
    expect(settings.portalOrgId).toBe(cuid);
    expect(settings.portalOrgId).not.toBe(expectedId);
  });

  it("existing org login: self-heals a MISSING workpipe-tools portalOrgId (#55)", async () => {
    const cuid = "clv9k2x7a0016heal00heal000";
    const companyId = uuidV5(cuid, PORTAL_ORG_UUID_NAMESPACE);
    // Org predates the per-company setting: the company row exists but has no
    // portalOrgId row (get -> null), so WorkPipe tools would fail closed.
    const { db } = createFakeDb({ companies: [{ id: companyId, name: "Heal Co" }] });
    pluginSettingsGet.mockResolvedValue(null);
    const app = createApp(db);
    const token = makePortalJwt({ email: "heal@example.com", org_id: cuid, org_name: "Heal Co" });

    const res = await request(app).get("/conductor/auth/callback").query({ token });

    expect(res.status).toBe(302);
    expect(pluginSettingsUpsert).toHaveBeenCalledWith(companyId, WORKPIPE_PLUGIN_DB_ID, {
      portalOrgId: cuid,
    });
  });

  it("existing org login: does NOT clobber an already-set portalOrgId (#55)", async () => {
    const cuid = "clv9k2x7a0017keep00keep000";
    const companyId = uuidV5(cuid, PORTAL_ORG_UUID_NAMESPACE);
    const { db } = createFakeDb({ companies: [{ id: companyId, name: "Keep Co" }] });
    // A value is already set (e.g. a manual correction) — must be preserved.
    pluginSettingsGet.mockResolvedValue({
      companyId,
      pluginId: WORKPIPE_PLUGIN_DB_ID,
      settingsJson: { portalOrgId: "manually-corrected-cuid" },
    });
    const app = createApp(db);
    const token = makePortalJwt({ email: "keep@example.com", org_id: cuid, org_name: "Keep Co" });

    const res = await request(app).get("/conductor/auth/callback").query({ token });

    expect(res.status).toBe(302);
    expect(pluginSettingsUpsert).not.toHaveBeenCalled();
  });

  it("new org first login: skips the settings write when workpipe-tools is not registered", async () => {
    const { db, state } = createFakeDb();
    getPluginByKey.mockResolvedValue(null);
    const app = createApp(db);
    const token = makePortalJwt({
      email: "noplugin@example.com",
      org_id: "clv9k2x7a0015nopl000nopl0",
    });

    const res = await request(app).get("/conductor/auth/callback").query({ token });

    // No plugin row -> nothing written, but the login is unaffected.
    expect(pluginSettingsUpsert).not.toHaveBeenCalled();
    expect(res.status).toBe(302);
    expect(state.sessions).toHaveLength(1);
    expect(res.header["set-cookie"]).toBeDefined();
  });

  it("new org first login: a rejected settings upsert never fails the login (best-effort)", async () => {
    const cuid = "clv9k2x7a0016boom000boom00";
    const expectedId = uuidV5(cuid, PORTAL_ORG_UUID_NAMESPACE);
    const { db, state } = createFakeDb();
    pluginSettingsUpsert.mockRejectedValue(new Error("settings write blew up"));
    const app = createApp(db);
    const token = makePortalJwt({ email: "swallow@example.com", org_id: cuid });
    const infoSpy = vi.spyOn(logger, "info").mockImplementation(() => logger);

    const res = await request(app).get("/conductor/auth/callback").query({ token });

    expect(pluginSettingsUpsert).toHaveBeenCalledTimes(1);
    // Same posture as the CEO seed: logged and swallowed, provisioning still completes.
    expect(res.status).toBe(302);
    expect(state.companies[0].id).toBe(expectedId);
    expect(state.memberships).toHaveLength(1);
    expect(state.sessions).toHaveLength(1);
    // Discriminates swallow from rethrow: an escaping error would be absorbed by the
    // create-race catch, which re-reads the row and downgrades companyCreated to false.
    const exchange = infoSpy.mock.calls.find(
      (call) => call[1] === "Portal JWT exchanged for Conductor session",
    );
    expect((exchange?.[0] as { companyCreated?: boolean })?.companyCreated).toBe(true);
    infoSpy.mockRestore();
  });

  // NOTE: the former "existing org login: does NOT rewrite the workpipe-tools
  // setting" test was removed — its premise (existing logins never touch the
  // per-company portalOrgId) WAS the #55 bug. The two "#55" tests above now cover
  // the correct behavior: back-fill when missing, never clobber when set.
});

describe("resolvePortalCompany", () => {
  const base = {
    sub: "s",
    email: "e@example.com",
    app_access: ["CONDUCTOR"],
    iat: 0,
    exp: 0,
  };

  it("uses the default company (fallback=true) when org_id is missing", () => {
    const r = resolvePortalCompany({ ...base });
    expect(r.companyId).toBe(DEFAULT_PORTAL_COMPANY_ID);
    expect(r.fallback).toBe(true);
  });

  it("passes a UUID org_id through unchanged (fallback=false)", () => {
    const uuid = "33333333-3333-4333-a333-333333333333";
    const r = resolvePortalCompany({ ...base, org_id: uuid });
    expect(r.companyId).toBe(uuid);
    expect(r.fallback).toBe(false);
  });

  it("derives a UUIDv5 for a CUID org_id (fallback=false)", () => {
    const cuid = "clv9k2x7a0009cccc3333cccc";
    const r = resolvePortalCompany({ ...base, org_id: cuid });
    expect(r.companyId).toBe(uuidV5(cuid, PORTAL_ORG_UUID_NAMESPACE));
    expect(r.fallback).toBe(false);
  });

  it("prefers org_name over org_slug for the company name", () => {
    const r = resolvePortalCompany({ ...base, org_id: "x", org_name: "Real Name", org_slug: "slug" });
    expect(r.name).toBe("Real Name");
  });
});

describe("isSafeRedirectTarget", () => {
  it("accepts simple absolute paths", () => {
    expect(isSafeRedirectTarget("/")).toBe(true);
    expect(isSafeRedirectTarget("/foo/bar")).toBe(true);
    expect(isSafeRedirectTarget("/foo?x=1#frag")).toBe(true);
  });

  it("rejects protocol-relative URLs and absolute URLs", () => {
    expect(isSafeRedirectTarget("//evil.com")).toBe(false);
    expect(isSafeRedirectTarget("https://evil.com")).toBe(false);
    expect(isSafeRedirectTarget("http://evil.com")).toBe(false);
  });

  it("rejects empty / non-string / backslash-laced inputs", () => {
    expect(isSafeRedirectTarget("")).toBe(false);
    expect(isSafeRedirectTarget(undefined)).toBe(false);
    expect(isSafeRedirectTarget(null)).toBe(false);
    expect(isSafeRedirectTarget("/path\\\\with-backslash")).toBe(false);
  });
});
