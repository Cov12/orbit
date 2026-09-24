import type { SubStatus, AppType } from '@prisma/client';

// Subscription statuses that still count as entitled. The license edition no
// longer creates subscriptions, but the Subscription model is retained for
// existing rows and for the cross-app JWT `subscriptions` claim.
export const ACTIVE_SUBSCRIPTION_STATUSES: ReadonlyArray<SubStatus> = ['ACTIVE', 'TRIALING'];

const ACTIVE_STATUS_SET: ReadonlySet<SubStatus> = new Set(ACTIVE_SUBSCRIPTION_STATUSES);

export interface OrgWithRelations {
  subscriptions: ReadonlyArray<{ app: AppType; status: SubStatus }>;
  appAccess: ReadonlyArray<{ app: AppType; enabled: boolean }>;
}

export interface EffectiveAppAccessEntry {
  app: AppType;
  enabled: boolean;
}

// Every app Orbit ships. Iterated to build a complete status map so UI consumers
// always get an explicit entry (true/false) for each app rather than a partial map.
export const ALL_APP_TYPES: ReadonlyArray<AppType> = ['ATRIUM', 'CONDUCTOR', 'DRIVE', 'WORKPIPE'];

export type AppEntitlementMap = Record<AppType, boolean>;

export function isSubscriptionActive(status: SubStatus): boolean {
  return ACTIVE_STATUS_SET.has(status);
}

// The `licensed` parameter reflects license mode (see lib/license.ts): when the
// deployment runs under a term license, every org is fully entitled to every app
// and subscription gating is bypassed. It is threaded in (rather than read
// from env inside these pure functions) so the selectors stay pure and testable.
export function conductorActive(org: OrgWithRelations, licensed = false): boolean {
  if (licensed) return true;
  const hasActiveAtrium = org.subscriptions.some(
    (s) => s.app === 'ATRIUM' && isSubscriptionActive(s.status)
  );
  if (!hasActiveAtrium) return false;
  return org.appAccess.some((a) => a.app === 'CONDUCTOR' && a.enabled);
}

export function getEffectiveAppAccessEntries(
  org: OrgWithRelations,
  licensed = false
): EffectiveAppAccessEntry[] {
  if (licensed) {
    return ALL_APP_TYPES.map((app) => ({ app, enabled: true })).sort((a, b) =>
      a.app.localeCompare(b.app)
    );
  }
  return org.appAccess
    .map((a) => ({
      app: a.app,
      enabled: a.app === 'CONDUCTOR' ? conductorActive(org) : a.enabled,
    }))
    .sort((a, b) => a.app.localeCompare(b.app));
}

export function getEffectiveAppAccess(
  org: OrgWithRelations,
  isPlatformAdmin: boolean,
  licensed = false
): AppType[] {
  if (licensed) {
    // Term license → full entitlement to every app, regardless of subscription.
    return [...ALL_APP_TYPES].sort((a, b) => a.localeCompare(b));
  }
  if (isPlatformAdmin) {
    // Admins get the base apps without an AppAccess row; CONDUCTOR still requires real entitlement.
    const base: AppType[] = ['ATRIUM', 'DRIVE', 'WORKPIPE'];
    if (conductorActive(org)) base.push('CONDUCTOR');
    return Array.from(new Set(base)).sort((a, b) => a.localeCompare(b));
  }
  return getEffectiveAppAccessEntries(org)
    .filter((a) => a.enabled)
    .map((a) => a.app);
}

/**
 * The single UI-facing entitlement selector. Returns a complete per-app map of
 * whether the org/user is entitled to each app, derived EXACTLY from
 * getEffectiveAppAccess — i.e. the same set the signed JWT grants. Every
 * entitlement surface (dashboard, apps grid, per-app landing pages) must derive
 * its "Active / Not Enabled" status from this, so the UI can never disagree
 * with what the token actually authorizes.
 *
 * `true`  => entitled now (app opens; show "Active"/"Included").
 * `false` => not entitled (show "Not Enabled").
 */
export function getAppEntitlementMap(
  org: OrgWithRelations,
  isPlatformAdmin: boolean,
  licensed = false
): AppEntitlementMap {
  const granted = new Set<AppType>(getEffectiveAppAccess(org, isPlatformAdmin, licensed));
  return ALL_APP_TYPES.reduce((acc, app) => {
    acc[app] = granted.has(app);
    return acc;
  }, {} as AppEntitlementMap);
}
