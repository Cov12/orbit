/**
 * License mode — lets the whole ecosystem run without any Stripe subscription,
 * as if licensed for a fixed term (on-prem / self-hosted / single-tenant cloud).
 * When active, every org is treated as fully entitled to all apps and the
 * billing/subscription gates are bypassed end-to-end (JWT app_access, the
 * subscriptions claim, the entitlement UI, and Conductor-sync).
 *
 * Controlled entirely by environment — no per-org DB state in v1:
 *   ORBIT_LICENSE_MODE        "1" | "true" | "on" | "yes" to enable
 *   ORBIT_LICENSE_EXPIRES_AT  optional ISO date/datetime; once past, the license
 *                            lapses and normal subscription gating resumes.
 *
 * A future per-org `License { orgId, plan, expiresAt }` table can layer on top
 * of this global switch without changing any call site — callers consume the
 * boolean below, not the env vars directly.
 */
const TRUTHY = new Set(["1", "true", "on", "yes"]);

/**
 * Whether license mode is currently active. `now` is injectable for testing.
 *
 * Fails CLOSED: if ORBIT_LICENSE_EXPIRES_AT is set but unparseable, the license
 * is treated as INACTIVE (and logged) so a typo can't silently grant unlimited
 * access. Operators see everything locked and fix the env, rather than the
 * reverse.
 */
export function isLicenseActive(now: Date = new Date()): boolean {
  const flag = (process.env.ORBIT_LICENSE_MODE ?? "").trim().toLowerCase();
  if (!TRUTHY.has(flag)) return false;

  const expiresRaw = process.env.ORBIT_LICENSE_EXPIRES_AT?.trim();
  if (expiresRaw) {
    const expiresAt = new Date(expiresRaw);
    if (Number.isNaN(expiresAt.getTime())) {
      console.error(
        `[license] invalid ORBIT_LICENSE_EXPIRES_AT: "${expiresRaw}" — treating license as INACTIVE`
      );
      return false;
    }
    if (now.getTime() > expiresAt.getTime()) return false;
  }

  return true;
}

/**
 * Effective license for a specific org: the instance-wide env switch
 * (`isLicenseActive()`, used for standalone/VPS deployments where the whole
 * instance is licensed) OR the org's own `licensed` flag (super-admin toggle in
 * shared cloud). Either path fully entitles the org with no subscription.
 *
 * Accepts a partial org so callers can pass whatever they've loaded; a missing
 * `licensed` field degrades safely to the global switch only.
 */
export function isOrgLicensed(
  org: { licensed?: boolean | null } | null | undefined,
  now: Date = new Date()
): boolean {
  return isLicenseActive(now) || !!org?.licensed;
}
