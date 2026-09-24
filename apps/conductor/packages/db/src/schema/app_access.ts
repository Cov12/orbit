import { pgTable, uuid, text, timestamp, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

/**
 * `app_access` table — DB-backed, per-company entitlement for Orbit ecosystem apps
 * (e.g. "CONDUCTOR", "ATRIUM", "WORKPIPE"). This retires the transient JWT-claim-only
 * access gate: instead of trusting a per-request Portal claim in isolation, each login
 * reconciles the claim into this durable per-company table (see
 * `server/src/services/app-access.ts` and the portal-callback upsert-on-launch).
 *
 * Semantics are DEFAULT-ON (mirroring `plugin_company_settings`):
 * - no row for (company, app) => the app is accessible for that company by default
 * - row with `enabled = false`  => the app is explicitly disabled for that company
 * - row with `enabled = true`   => the app is explicitly enabled for that company
 *
 * Backfill: none required. Default-on means an empty table locks nobody out, and
 * upsert-on-launch populates each company's row set from its Portal claim on next login.
 */
export const appAccess = pgTable(
  "app_access",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    app: text("app").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("app_access_company_idx").on(table.companyId),
    companyAppUq: uniqueIndex("app_access_company_app_uq").on(table.companyId, table.app),
  }),
);
