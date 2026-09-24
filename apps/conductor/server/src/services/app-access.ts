import { and, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { appAccess } from "@paperclipai/db";

/**
 * DB-backed, per-company AppAccess entitlement resolver.
 *
 * Semantics are DEFAULT-ON (see `packages/db/src/schema/app_access.ts`):
 * - no row for (company, app) => accessible by default (absent row => enabled)
 * - row with `enabled = false`  => explicitly denied
 * - row with `enabled = true`   => explicitly granted
 *
 * This is the durable sibling of the transient Portal JWT `app_access` claim: each
 * portal-callback login reconciles the claim into this table (upsert-on-launch) so
 * access no longer depends on a single request's claim being present in isolation.
 */

// Apps we always reconcile even when absent from a login's claim, so that a claim
// lacking the app persists an explicit `enabled = false` row (belt-and-suspenders with
// the JWT-claim gate). CONDUCTOR is the only gated app today; add siblings here as they
// gain per-company gating.
const ALWAYS_RECONCILED_APPS = ["CONDUCTOR"] as const;

/**
 * Returns the set of apps a company has an explicit `enabled = true` row for.
 *
 * NOTE: because access is DEFAULT-ON, this set is NOT the full universe of accessible
 * apps — an app absent from the returned set may still be accessible (no row => enabled).
 * Use {@link canAccessApp} to answer "can this company use app X?"; use this to enumerate
 * the apps that have been explicitly granted/persisted for a company.
 */
export async function getEffectiveAppAccess(db: Db, companyId: string): Promise<Set<string>> {
  const rows = await db
    .select({ app: appAccess.app, enabled: appAccess.enabled })
    .from(appAccess)
    .where(eq(appAccess.companyId, companyId));
  const set = new Set<string>();
  for (const row of rows) {
    if (row.enabled) set.add(row.app);
  }
  return set;
}

/**
 * DEFAULT-ON access check: an app is accessible for a company unless an explicit row
 * disables it. Absent row => accessible.
 */
export async function canAccessApp(db: Db, companyId: string, app: string): Promise<boolean> {
  const row = await db
    .select({ enabled: appAccess.enabled })
    .from(appAccess)
    .where(and(eq(appAccess.companyId, companyId), eq(appAccess.app, app)))
    .then((rows: { enabled: boolean }[]) => rows[0] ?? null);
  // Absent row => accessible (default-on). Present row => honor its `enabled` flag.
  return row ? row.enabled : true;
}

/**
 * Persist a company's entitlement from a known set of enabled apps (upsert-on-launch).
 *
 * For every app in the "known universe" — the union of `enabledApps`, the apps this
 * company already has rows for, and {@link ALWAYS_RECONCILED_APPS} — this sets
 * `enabled = enabledApps.includes(app)`. So an app present in the claim is set enabled,
 * and a known app absent from the claim (e.g. a previously-granted app, or CONDUCTOR) is
 * set `enabled = false`. Idempotent: re-running with the same claim converges.
 */
export async function reconcileAppAccess(
  db: Db,
  companyId: string,
  enabledApps: string[],
): Promise<void> {
  const existing = await db
    .select({ app: appAccess.app })
    .from(appAccess)
    .where(eq(appAccess.companyId, companyId));

  const knownApps = new Set<string>([
    ...ALWAYS_RECONCILED_APPS,
    ...enabledApps,
    ...existing.map((row: { app: string }) => row.app),
  ]);
  const enabledSet = new Set(enabledApps);

  const now = new Date();
  for (const app of knownApps) {
    const enabled = enabledSet.has(app);
    await db
      .insert(appAccess)
      .values({ companyId, app, enabled, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: [appAccess.companyId, appAccess.app],
        set: { enabled, updatedAt: now },
      });
  }
}
