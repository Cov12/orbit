import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { companies, createDb, pluginCompanySettings, plugins } from "@paperclipai/db";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";
import { pluginCompanySettingsService } from "../services/plugin-company-settings.js";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

async function createCompany(db: ReturnType<typeof createDb>): Promise<string> {
  const company = await db
    .insert(companies)
    .values({
      name: `Plugin Company Settings ${randomUUID()}`,
      issuePrefix: `PCS${randomUUID().slice(0, 5).toUpperCase()}`,
    })
    .returning()
    .then((rows) => rows[0]!);
  return company.id;
}

async function createPlugin(db: ReturnType<typeof createDb>): Promise<string> {
  const pluginKey = `acme.plugin-${randomUUID().slice(0, 8)}`;
  const plugin = await db
    .insert(plugins)
    .values({
      pluginKey,
      packageName: `@acme/${pluginKey}`,
      version: "1.0.0",
      apiVersion: 1,
      categories: ["automation"],
      manifestJson: {
        id: pluginKey,
        apiVersion: 1,
        version: "1.0.0",
        displayName: "Acme Test Plugin",
        description: "Test plugin for per-company settings",
        author: "Acme",
        categories: ["automation"],
        capabilities: [],
        entrypoints: { worker: "dist/worker.js" },
      } as never,
    })
    .returning()
    .then((rows) => rows[0]!);
  return plugin.id;
}

describeEmbeddedPostgres("plugin-company-settings service", () => {
  let db!: ReturnType<typeof createDb>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;
  let service!: ReturnType<typeof pluginCompanySettingsService>;

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("paperclip-plugin-company-settings-");
    db = createDb(tempDb.connectionString);
    service = pluginCompanySettingsService(db);
  }, 20_000);

  afterEach(async () => {
    await db.delete(pluginCompanySettings);
    await db.delete(plugins);
    await db.delete(companies);
  });

  afterAll(async () => {
    await tempDb?.cleanup();
  });

  it("get returns null when the company has no row for the plugin", async () => {
    const companyId = await createCompany(db);
    const pluginId = await createPlugin(db);
    expect(await service.get(companyId, pluginId)).toBeNull();
  });

  it("upsert inserts a new row with the given settingsJson and returns it", async () => {
    const companyId = await createCompany(db);
    const pluginId = await createPlugin(db);

    const inserted = await service.upsert(companyId, pluginId, { externalOrgId: "org-a" });

    expect(inserted.companyId).toBe(companyId);
    expect(inserted.pluginId).toBe(pluginId);
    expect(inserted.settingsJson).toEqual({ externalOrgId: "org-a" });
    // Schema defaults apply on insert when the caller supplies no flags.
    expect(inserted.enabled).toBe(true);
    expect(inserted.lastError).toBeNull();

    expect(await service.get(companyId, pluginId)).toEqual(inserted);
  });

  it("upsert on an existing pair updates settingsJson without creating a second row", async () => {
    const companyId = await createCompany(db);
    const pluginId = await createPlugin(db);

    const first = await service.upsert(companyId, pluginId, { externalOrgId: "org-a" });
    const second = await service.upsert(companyId, pluginId, { externalOrgId: "org-b" });

    // Same row, updated in place.
    expect(second.id).toBe(first.id);
    expect(second.settingsJson).toEqual({ externalOrgId: "org-b" });

    const reread = await service.get(companyId, pluginId);
    expect(reread?.settingsJson).toEqual({ externalOrgId: "org-b" });

    const allRows = await db
      .select()
      .from(pluginCompanySettings)
      .where(eq(pluginCompanySettings.companyId, companyId));
    expect(allRows).toHaveLength(1);
  });

  it("upsert leaves enabled/lastError unchanged when those opts are omitted", async () => {
    const companyId = await createCompany(db);
    const pluginId = await createPlugin(db);

    await service.upsert(
      companyId,
      pluginId,
      { externalOrgId: "org-a" },
      { enabled: false, lastError: "boom" },
    );

    // Update carrying only settings must not clobber the stored flags.
    const updated = await service.upsert(companyId, pluginId, { externalOrgId: "org-b" });
    expect(updated.settingsJson).toEqual({ externalOrgId: "org-b" });
    expect(updated.enabled).toBe(false);
    expect(updated.lastError).toBe("boom");

    // Supplying them explicitly does write them (including clearing lastError with null).
    const cleared = await service.upsert(
      companyId,
      pluginId,
      { externalOrgId: "org-b" },
      { enabled: true, lastError: null },
    );
    expect(cleared.enabled).toBe(true);
    expect(cleared.lastError).toBeNull();
  });

  it("scopes rows per (company, plugin) pair", async () => {
    const companyA = await createCompany(db);
    const companyB = await createCompany(db);
    const pluginId = await createPlugin(db);

    await service.upsert(companyA, pluginId, { externalOrgId: "org-a" });
    await service.upsert(companyB, pluginId, { externalOrgId: "org-b" });

    expect((await service.get(companyA, pluginId))?.settingsJson).toEqual({ externalOrgId: "org-a" });
    expect((await service.get(companyB, pluginId))?.settingsJson).toEqual({ externalOrgId: "org-b" });
    expect(await service.list(companyA)).toHaveLength(1);
  });
});
