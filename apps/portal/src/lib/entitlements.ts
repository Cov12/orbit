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
