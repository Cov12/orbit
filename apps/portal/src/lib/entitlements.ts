import type { SubStatus, AppType } from '@prisma/client';

// Trialing is included because Stripe charges automatically at trial-end —
// users in trial should have full feature access until canceled.
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

export function isSubscriptionActive(status: SubStatus): boolean {
  return ACTIVE_STATUS_SET.has(status);
}

export function conductorActive(org: OrgWithRelations): boolean {
  const hasActiveAtrium = org.subscriptions.some(
    (s) => s.app === 'ATRIUM' && isSubscriptionActive(s.status)
  );
  if (!hasActiveAtrium) return false;
  return org.appAccess.some((a) => a.app === 'CONDUCTOR' && a.enabled);
}

export function getEffectiveAppAccessEntries(org: OrgWithRelations): EffectiveAppAccessEntry[] {
  return org.appAccess
    .map((a) => ({
      app: a.app,
      enabled: a.app === 'CONDUCTOR' ? conductorActive(org) : a.enabled,
    }))
    .sort((a, b) => a.app.localeCompare(b.app));
}

export function getEffectiveAppAccess(
  org: OrgWithRelations,
  isPlatformAdmin: boolean
): AppType[] {
  if (isPlatformAdmin) {
    // Admins get the base apps free; CONDUCTOR still requires real entitlement.
    const base: AppType[] = ['ATRIUM', 'DRIVE', 'WORKPIPE'];
    if (conductorActive(org)) base.push('CONDUCTOR');
    return Array.from(new Set(base)).sort((a, b) => a.localeCompare(b));
  }
  return getEffectiveAppAccessEntries(org)
    .filter((a) => a.enabled)
    .map((a) => a.app);
}

// Every app Orbit ships. Iterated to build a complete status map so UI consumers
// always get an explicit entry (true/false) for each app rather than a partial map.
export const ALL_APP_TYPES: ReadonlyArray<AppType> = ['ATRIUM', 'CONDUCTOR', 'DRIVE', 'WORKPIPE'];

export type AppEntitlementMap = Record<AppType, boolean>;

/**
 * The single UI-facing entitlement selector. Returns a complete per-app map of
 * whether the org/user is entitled to each app, derived EXACTLY from
 * getEffectiveAppAccess — i.e. the same set the signed JWT grants. Every
 * entitlement surface (dashboard, apps grid, per-app landing pages) must derive
 * its "Active / Upgrade Required" status from this, so the UI can never disagree
 * with what the token actually authorizes.
 *
 * `true`  => entitled now (app opens; show "Active"/"Included").
 * `false` => not entitled (show "Upgrade Required").
 */
export function getAppEntitlementMap(
  org: OrgWithRelations,
  isPlatformAdmin: boolean
): AppEntitlementMap {
  const granted = new Set<AppType>(getEffectiveAppAccess(org, isPlatformAdmin));
  return ALL_APP_TYPES.reduce((acc, app) => {
    acc[app] = granted.has(app);
    return acc;
  }, {} as AppEntitlementMap);
}
