import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { appAccess, companies, createDb } from "@paperclipai/db";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";
import {
  canAccessApp,
  getEffectiveAppAccess,
  reconcileAppAccess,
} from "../services/app-access.js";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

async function createCompany(db: ReturnType<typeof createDb>): Promise<string> {
  const company = await db
    .insert(companies)
    .values({
      name: `App Access ${randomUUID()}`,
      issuePrefix: `AA${randomUUID().slice(0, 6).toUpperCase()}`,
    })
    .returning()
    .then((rows) => rows[0]!);
  return company.id;
}

async function rowFor(
  db: ReturnType<typeof createDb>,
  companyId: string,
  app: string,
): Promise<{ enabled: boolean } | null> {
  return db
    .select({ enabled: appAccess.enabled })
    .from(appAccess)
    .where(and(eq(appAccess.companyId, companyId), eq(appAccess.app, app)))
    .then((rows) => rows[0] ?? null);
}

describeEmbeddedPostgres("app-access service", () => {
  let db!: ReturnType<typeof createDb>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("paperclip-app-access-service-");
    db = createDb(tempDb.connectionString);
  }, 20_000);

  afterEach(async () => {
    await db.delete(appAccess);
    await db.delete(companies);
  });

  afterAll(async () => {
    await tempDb?.cleanup();
  });

  describe("canAccessApp / getEffectiveAppAccess (default-on)", () => {
    it("absent row => app is accessible (default-on)", async () => {
      const companyId = await createCompany(db);
      expect(await canAccessApp(db, companyId, "CONDUCTOR")).toBe(true);
      expect(await getEffectiveAppAccess(db, companyId)).toEqual(new Set());
    });

    it("explicit enabled=false => access denied", async () => {
      const companyId = await createCompany(db);
      await db.insert(appAccess).values({ companyId, app: "CONDUCTOR", enabled: false });
      expect(await canAccessApp(db, companyId, "CONDUCTOR")).toBe(false);
      // A disabled app is not part of the effective (explicitly-enabled) set.
      expect(await getEffectiveAppAccess(db, companyId)).toEqual(new Set());
    });

    it("explicit enabled=true => access allowed and app is in the effective set", async () => {
      const companyId = await createCompany(db);
      await db.insert(appAccess).values({ companyId, app: "CONDUCTOR", enabled: true });
      await db.insert(appAccess).values({ companyId, app: "WORKPIPE", enabled: false });
      expect(await canAccessApp(db, companyId, "CONDUCTOR")).toBe(true);
      expect(await getEffectiveAppAccess(db, companyId)).toEqual(new Set(["CONDUCTOR"]));
    });

    it("scopes rows per company (one company's disable does not affect another)", async () => {
      const companyA = await createCompany(db);
      const companyB = await createCompany(db);
      await db.insert(appAccess).values({ companyId: companyA, app: "CONDUCTOR", enabled: false });
      expect(await canAccessApp(db, companyA, "CONDUCTOR")).toBe(false);
      expect(await canAccessApp(db, companyB, "CONDUCTOR")).toBe(true);
    });
  });

  describe("reconcileAppAccess", () => {
    it("sets enabled per the claim (present=true) and forces CONDUCTOR=false when absent", async () => {
      const companyId = await createCompany(db);
      await reconcileAppAccess(db, companyId, ["ATRIUM"]);

      // Claim app present => enabled.
      expect(await rowFor(db, companyId, "ATRIUM")).toEqual({ enabled: true });
      // CONDUCTOR is always reconciled; absent from the claim => explicit disable.
      expect(await rowFor(db, companyId, "CONDUCTOR")).toEqual({ enabled: false });
      expect(await canAccessApp(db, companyId, "CONDUCTOR")).toBe(false);
    });

    it("disables a previously-granted app when a later claim omits it (known-absent=false)", async () => {
      const companyId = await createCompany(db);
      await reconcileAppAccess(db, companyId, ["CONDUCTOR", "ATRIUM"]);
      expect(await rowFor(db, companyId, "CONDUCTOR")).toEqual({ enabled: true });
      expect(await rowFor(db, companyId, "ATRIUM")).toEqual({ enabled: true });

      // Second login: claim now only carries CONDUCTOR. ATRIUM is a known app (has a row)
      // absent from the claim, so it flips to disabled.
      await reconcileAppAccess(db, companyId, ["CONDUCTOR"]);
      expect(await rowFor(db, companyId, "CONDUCTOR")).toEqual({ enabled: true });
      expect(await rowFor(db, companyId, "ATRIUM")).toEqual({ enabled: false });
    });

    it("is idempotent (re-running with the same claim converges)", async () => {
      const companyId = await createCompany(db);
      await reconcileAppAccess(db, companyId, ["CONDUCTOR", "ATRIUM"]);
      await reconcileAppAccess(db, companyId, ["CONDUCTOR", "ATRIUM"]);

      const rows = await db
        .select({ app: appAccess.app, enabled: appAccess.enabled })
        .from(appAccess)
        .where(eq(appAccess.companyId, companyId));
      // Exactly one row per app (unique upsert), both enabled.
      expect(rows).toHaveLength(2);
      expect(await getEffectiveAppAccess(db, companyId)).toEqual(new Set(["CONDUCTOR", "ATRIUM"]));
    });

    it("empty claim persists an explicit CONDUCTOR disable (belt-and-suspenders)", async () => {
      const companyId = await createCompany(db);
      await reconcileAppAccess(db, companyId, []);
      expect(await rowFor(db, companyId, "CONDUCTOR")).toEqual({ enabled: false });
      expect(await canAccessApp(db, companyId, "CONDUCTOR")).toBe(false);
    });
  });
});
