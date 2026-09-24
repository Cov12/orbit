import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mirror portal-callback.test.ts: mock drizzle-orm's clause builders so a hand-rolled fake
// db can interpret them. Adds inArray on top of eq/and for the session-invalidation delete.
vi.mock("drizzle-orm", () => ({
  eq: (col: { __col?: string } | unknown, value: unknown) => {
    const colName = (col as { __col?: string })?.__col;
    return { __op: "eq", __col: colName, __value: value };
  },
  and: (...clauses: unknown[]) => ({ __op: "and", __clauses: clauses }),
  inArray: (col: { __col?: string } | unknown, values: unknown[]) => {
    const colName = (col as { __col?: string })?.__col;
    return { __op: "inArray", __col: colName, __values: values };
  },
}));
vi.mock("@paperclipai/db", () => ({
  authSessions: { __name: "session", userId: { __col: "userId" } },
  companies: { __name: "company", id: { __col: "id" } },
  companyMemberships: {
    __name: "membership",
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

import { errorHandler } from "../middleware/index.js";
import { portalWebhookRoutes } from "../routes/portal-webhooks.js";
import { resolvePortalOrgCompanyId } from "../routes/portal-callback.js";

const WEBHOOK_SECRET = "portal-secret-for-tests";
const SECRET_HEADER = "x-orbit-bridge-secret";
const ENDPOINT = "/api/webhooks/portal/entitlements";

const originalSecret = process.env.ORBIT_PORTAL_JWT_SECRET;

beforeEach(() => {
  process.env.ORBIT_PORTAL_JWT_SECRET = WEBHOOK_SECRET;
});

afterEach(() => {
  if (originalSecret === undefined) delete process.env.ORBIT_PORTAL_JWT_SECRET;
  else process.env.ORBIT_PORTAL_JWT_SECRET = originalSecret;
});

interface FakeSessionRow {
  id: string;
  token: string;
  userId: string;
}
interface FakeMembershipRow {
  id: string;
  companyId: string;
  principalType: string;
  principalId: string;
}
interface FakeCompanyRow {
  id: string;
}
interface FakeAppAccessRow {
  companyId: string;
  app: string;
  enabled: boolean;
}

interface FakeDbState {
  sessions: FakeSessionRow[];
  memberships: FakeMembershipRow[];
  appAccess: FakeAppAccessRow[];
  companies: FakeCompanyRow[];
}

function evalClause(row: Record<string, unknown>, clause: unknown): boolean {
  if (!clause || typeof clause !== "object") return true;
  const c = clause as {
    __op?: string;
    __col?: string;
    __value?: unknown;
    __values?: unknown[];
    __clauses?: unknown[];
  };
  if (c.__op === "and" && Array.isArray(c.__clauses)) {
    return c.__clauses.every((sub) => evalClause(row, sub));
  }
  if (c.__op === "inArray" && c.__col && Array.isArray(c.__values)) {
    return c.__values.includes(row[c.__col]);
  }
  if (c.__op === "eq" && c.__col) {
    return row[c.__col] === c.__value;
  }
  return true;
}

function createFakeDb(initial?: {
  sessions?: FakeSessionRow[];
  memberships?: FakeMembershipRow[];
  appAccess?: FakeAppAccessRow[];
  companies?: FakeCompanyRow[];
  // Race hook: runs immediately before each app_access write, so a test can delete the
  // company *between* the route's existence check and the insert.
  beforeAppAccessWrite?: () => void;
}) {
  const state: FakeDbState = {
    sessions: [...(initial?.sessions ?? [])],
    memberships: [...(initial?.memberships ?? [])],
    appAccess: [...(initial?.appAccess ?? [])],
    companies: [...(initial?.companies ?? [])],
  };

  function tableRows(name: string): Record<string, unknown>[] {
    if (name === "session") return state.sessions as unknown as Record<string, unknown>[];
    if (name === "membership") return state.memberships as unknown as Record<string, unknown>[];
    if (name === "app_access") return state.appAccess as unknown as Record<string, unknown>[];
    if (name === "company") return state.companies as unknown as Record<string, unknown>[];
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
          // app_access is written only via reconcileAppAccess' upsert.
          if (table.__name === "app_access") {
            const applyUpsert = () => {
              initial?.beforeAppAccessWrite?.();
              const companyId = String(row.companyId);
              // Stand-in for the real `app_access.company_id -> companies.id` FK: Postgres
              // rejects a row whose company does not exist with SQLSTATE 23503. Without
              // this the stub silently accepts orphan rows and cannot reproduce the bug.
              if (!state.companies.some((c) => c.id === companyId)) {
                throw Object.assign(
                  new Error(
                    'insert or update on table "app_access" violates foreign key constraint '
                      + '"app_access_company_id_companies_id_fk"',
                  ),
                  { code: "23503", constraint: "app_access_company_id_companies_id_fk" },
                );
              }
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
          return Promise.resolve();
        },
      };
    },
    delete(table: { __name: string }) {
      return {
        where(predicate: unknown) {
          if (table.__name === "session") {
            state.sessions = state.sessions.filter(
              (row) => !evalClause(row as unknown as Record<string, unknown>, predicate),
            );
          }
          return Promise.resolve();
        },
      };
    },
  };

  return { db: db as unknown as Parameters<typeof portalWebhookRoutes>[0], state };
}

function createApp(db: Parameters<typeof portalWebhookRoutes>[0]) {
  const app = express();
  app.use(express.json());
  app.use(portalWebhookRoutes(db));
  app.use(errorHandler);
  return app;
}

const ORG = "clv9k2x7a0001abcd1234efgh"; // Portal Organization.id shape (cuid)
// Every pre-existing case describes an org that HAS logged in at least once, so its company
// row exists. Seeded explicitly now that the stub enforces the app_access -> companies FK
// (and so a 401/400 assertion proves auth/validation blocked the write, not the skip guard).
const PROVISIONED = [{ id: resolvePortalOrgCompanyId(ORG) }];

describe.sequential("portal entitlement webhook", () => {
  it("returns 401 and writes nothing when the shared secret is missing", async () => {
    const { db, state } = createFakeDb({
      companies: PROVISIONED,
      memberships: [{ id: "m1", companyId: resolvePortalOrgCompanyId(ORG), principalType: "user", principalId: "u1" }],
      sessions: [{ id: "s1", token: "t1", userId: "u1" }],
    });
    const app = createApp(db);

    const res = await request(app)
      .post(ENDPOINT)
      .send({ org_id: ORG, appAccess: [{ app: "CONDUCTOR", enabled: false }] });

    expect(res.status).toBe(401);
    expect(state.appAccess).toHaveLength(0);
    expect(state.sessions).toHaveLength(1);
  });

  it("returns 401 for a wrong shared secret (no DB writes)", async () => {
    const { db, state } = createFakeDb({ companies: PROVISIONED });
    const app = createApp(db);

    const res = await request(app)
      .post(ENDPOINT)
      .set(SECRET_HEADER, "wrong-secret")
      .send({ org_id: ORG, appAccess: [{ app: "CONDUCTOR", enabled: true }] });

    expect(res.status).toBe(401);
    expect(state.appAccess).toHaveLength(0);
  });

  it("upserts app_access via reconcile for a valid payload (idempotent)", async () => {
    const { db, state } = createFakeDb({ companies: PROVISIONED });
    const app = createApp(db);
    const companyId = resolvePortalOrgCompanyId(ORG);

    const send = () =>
      request(app)
        .post(ENDPOINT)
        .set(SECRET_HEADER, WEBHOOK_SECRET)
        .send({
          org_id: ORG,
          appAccess: [
            { app: "CONDUCTOR", enabled: true },
            { app: "ATRIUM", enabled: true },
          ],
        });

    const res = await send();
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, companyId, conductorDisabled: false });

    expect(state.appAccess.find((r) => r.app === "CONDUCTOR")).toEqual({
      companyId,
      app: "CONDUCTOR",
      enabled: true,
    });
    expect(state.appAccess.find((r) => r.app === "ATRIUM")).toEqual({
      companyId,
      app: "ATRIUM",
      enabled: true,
    });

    // Idempotent: re-POSTing converges to the same rows.
    await send();
    expect(state.appAccess.filter((r) => r.app === "CONDUCTOR")).toHaveLength(1);
    expect(state.appAccess.filter((r) => r.app === "ATRIUM")).toHaveLength(1);
  });

  it("CONDUCTOR disabled: invalidates every member's active sessions", async () => {
    const companyId = resolvePortalOrgCompanyId(ORG);
    const { db, state } = createFakeDb({
      companies: [{ id: companyId }],
      memberships: [
        { id: "m1", companyId, principalType: "user", principalId: "u1" },
        { id: "m2", companyId, principalType: "user", principalId: "u2" },
        // A member of a DIFFERENT company — must NOT be logged out.
        { id: "m3", companyId: "other-company", principalType: "user", principalId: "u3" },
      ],
      sessions: [
        { id: "s1", token: "t1", userId: "u1" },
        { id: "s2", token: "t2", userId: "u2" },
        { id: "s3", token: "t3", userId: "u3" },
      ],
    });
    const app = createApp(db);

    const res = await request(app)
      .post(ENDPOINT)
      .set(SECRET_HEADER, WEBHOOK_SECRET)
      .send({ org_id: ORG, appAccess: [{ app: "CONDUCTOR", enabled: false }] });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ conductorDisabled: true, sessionsInvalidated: 2 });
    // u1/u2 sessions gone; the other company's session survives.
    expect(state.sessions.map((s) => s.userId).sort()).toEqual(["u3"]);
    // Entitlement persisted as disabled.
    expect(state.appAccess.find((r) => r.app === "CONDUCTOR")).toEqual({
      companyId,
      app: "CONDUCTOR",
      enabled: false,
    });
  });

  it("CONDUCTOR enabled: sessions are left untouched", async () => {
    const companyId = resolvePortalOrgCompanyId(ORG);
    const { db, state } = createFakeDb({
      companies: [{ id: companyId }],
      memberships: [{ id: "m1", companyId, principalType: "user", principalId: "u1" }],
      sessions: [{ id: "s1", token: "t1", userId: "u1" }],
    });
    const app = createApp(db);

    const res = await request(app)
      .post(ENDPOINT)
      .set(SECRET_HEADER, WEBHOOK_SECRET)
      .send({ org_id: ORG, appAccess: [{ app: "CONDUCTOR", enabled: true }] });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ conductorDisabled: false, sessionsInvalidated: null });
    expect(state.sessions).toHaveLength(1);
  });

  it("non-CONDUCTOR disable leaves CONDUCTOR sessions untouched", async () => {
    const companyId = resolvePortalOrgCompanyId(ORG);
    const { db, state } = createFakeDb({
      companies: [{ id: companyId }],
      memberships: [{ id: "m1", companyId, principalType: "user", principalId: "u1" }],
      sessions: [{ id: "s1", token: "t1", userId: "u1" }],
    });
    const app = createApp(db);

    const res = await request(app)
      .post(ENDPOINT)
      .set(SECRET_HEADER, WEBHOOK_SECRET)
      .send({
        org_id: ORG,
        appAccess: [
          { app: "CONDUCTOR", enabled: true },
          { app: "WORKPIPE", enabled: false },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ conductorDisabled: false });
    expect(state.sessions).toHaveLength(1);
  });

  // --- company not provisioned yet (Portal grants access before anyone has ever logged in) ---

  it("absent company: 200 skip, writes no app_access and creates no company", async () => {
    const companyId = resolvePortalOrgCompanyId(ORG);
    // No companies seeded: this org has never completed a Conductor login.
    let writeAttempts = 0;
    const { db, state } = createFakeDb({
      beforeAppAccessWrite: () => {
        writeAttempts += 1;
      },
    });
    const app = createApp(db);

    const res = await request(app)
      .post(ENDPOINT)
      .set(SECRET_HEADER, WEBHOOK_SECRET)
      .send({
        org_id: ORG,
        appAccess: [
          { app: "CONDUCTOR", enabled: true },
          { app: "ATRIUM", enabled: true },
        ],
      });

    // 200 (not 500) is the whole point: Portal must treat the delivery as terminal
    // instead of retrying a write that can never succeed.
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, companyId, skipped: "company_not_provisioned" });
    // Nothing persisted, and provisioning stays owned by the login path.
    expect(state.appAccess).toHaveLength(0);
    expect(state.companies).toHaveLength(0);
    // The guard short-circuited BEFORE reconcile: no write was even attempted. (Without
    // this the FK catch would absorb the same request into an identical response, and the
    // test could not tell the two paths apart.)
    expect(writeAttempts).toBe(0);
  });

  it("absent company + CONDUCTOR revoke: 200 skip, no session deletions", async () => {
    const companyId = resolvePortalOrgCompanyId(ORG);
    const { db, state } = createFakeDb({
      // Memberships/sessions that must survive: with no company row there is nothing to
      // enforce against, and the request must not fall through to the invalidation path.
      memberships: [{ id: "m1", companyId, principalType: "user", principalId: "u1" }],
      sessions: [{ id: "s1", token: "t1", userId: "u1" }],
    });
    const app = createApp(db);

    const res = await request(app)
      .post(ENDPOINT)
      .set(SECRET_HEADER, WEBHOOK_SECRET)
      .send({ org_id: ORG, appAccess: [{ app: "CONDUCTOR", enabled: false }] });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, companyId, skipped: "company_not_provisioned" });
    expect(res.body.conductorDisabled).toBeUndefined();
    expect(state.appAccess).toHaveLength(0);
    expect(state.sessions).toHaveLength(1);
  });

  it("company deleted mid-write (FK 23503): mapped to the same 200 skip", async () => {
    const companyId = resolvePortalOrgCompanyId(ORG);
    // Check-then-write race: the company exists when the guard runs, and is gone by the
    // time reconcileAppAccess inserts — so the FK fires and the catch must absorb it.
    let racer: (() => void) | undefined;
    const { db, state } = createFakeDb({
      companies: [{ id: companyId }],
      memberships: [{ id: "m1", companyId, principalType: "user", principalId: "u1" }],
      sessions: [{ id: "s1", token: "t1", userId: "u1" }],
      beforeAppAccessWrite: () => racer?.(),
    });
    racer = () => {
      state.companies.length = 0;
    };
    const app = createApp(db);

    const res = await request(app)
      .post(ENDPOINT)
      .set(SECRET_HEADER, WEBHOOK_SECRET)
      .send({ org_id: ORG, appAccess: [{ app: "CONDUCTOR", enabled: false }] });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, companyId, skipped: "company_not_provisioned" });
    expect(state.appAccess).toHaveLength(0);
    // The revoke never reached the enforcement block.
    expect(state.sessions).toHaveLength(1);
  });

  it("a non-FK failure during reconcile still surfaces as a 500", async () => {
    const companyId = resolvePortalOrgCompanyId(ORG);
    const { db, state } = createFakeDb({
      companies: [{ id: companyId }],
      beforeAppAccessWrite: () => {
        throw Object.assign(new Error("deadlock detected"), { code: "40P01" });
      },
    });
    const app = createApp(db);

    const res = await request(app)
      .post(ENDPOINT)
      .set(SECRET_HEADER, WEBHOOK_SECRET)
      .send({ org_id: ORG, appAccess: [{ app: "CONDUCTOR", enabled: true }] });

    expect(res.status).toBe(500);
    expect(state.appAccess).toHaveLength(0);
  });

  it("returns 400 for malformed bodies", async () => {
    const { db, state } = createFakeDb({ companies: PROVISIONED });
    const app = createApp(db);
    const malformed = [
      {},
      { org_id: "", appAccess: [{ app: "CONDUCTOR", enabled: false }] },
      { org_id: ORG },
      { org_id: ORG, appAccess: [] },
      { org_id: ORG, appAccess: [{ app: "CONDUCTOR" }] },
      { org_id: ORG, appAccess: [{ app: "CONDUCTOR", enabled: "yes" }] },
      { org_id: ORG, appAccess: [{ enabled: false }] },
    ];

    for (const body of malformed) {
      const res = await request(app).post(ENDPOINT).set(SECRET_HEADER, WEBHOOK_SECRET).send(body);
      expect(res.status).toBe(400);
    }
    // No entitlement/session mutations from any malformed request.
    expect(state.appAccess).toHaveLength(0);
  });
});
