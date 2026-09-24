/**
 * License mode — this edition of the Portal ships without commercial billing:
 * every org is licensed for a term (on-prem / self-hosted / single-tenant cloud)
 * and is fully entitled to every app. License mode is therefore ON by default.
 * When active, entitlement is granted end-to-end: JWT `app_access`, the
 * synthesized `subscriptions` claim, the entitlement UI, and Conductor-sync.
 *
 * Controlled by environment:
 *   ORBIT_LICENSE_MODE        unset/empty → ON (the default for this edition).
 *                             "1" | "true" | "on" | "yes"  → ON.
 *                             "0" | "false" | "off" | "no" → OFF; entitlement
 *                             then comes only from per-org `licensed` flags and
 *                             explicit AppAccess rows.
 *                             Any other value fails CLOSED (OFF, logged).
 *   ORBIT_LICENSE_EXPIRES_AT  optional ISO date/datetime; once past, the license
 *                             lapses and license-mode entitlement stops.
 *
 * A future per-org `License { orgId, plan, expiresAt }` table can layer on top
 * of this global switch without changing any call site — callers consume the
 * boolean below, not the env vars directly.
 */
const TRUTHY = new Set(["1", "true", "on", "yes"]);
const FALSY = new Set(["0", "false", "off", "no"]);

/**
 * Whether license mode is currently active. `now` is injectable for testing.
 *
 * Fails CLOSED in two cases, so a typo can never silently grant unlimited access:
 *   - ORBIT_LICENSE_MODE is set to an unrecognized value, or
 *   - ORBIT_LICENSE_EXPIRES_AT is set but unparseable.
 * Both are logged; operators see everything locked and fix the env, rather than
 * the reverse.
 */
export function isLicenseActive(now: Date = new Date()): boolean {
  const flag = (process.env.ORBIT_LICENSE_MODE ?? "").trim().toLowerCase();
  if (FALSY.has(flag)) return false;
  if (flag !== "" && !TRUTHY.has(flag)) {
    console.error(
      `[license] unrecognized ORBIT_LICENSE_MODE: "${flag}" — treating license as INACTIVE`
    );
    return false;
  }

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
 * (`isLicenseActive()`, on by default) OR the org's own `licensed` flag
 * (super-admin toggle, which still applies when the instance switch is
 * explicitly off). Either path fully entitles the org to every app.
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
