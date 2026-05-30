import type { SubStatus, AppType } from '@prisma/client';

// Trialing is included because Stripe charges automatically at trial-end —
// users in trial should have full feature access until canceled.
export const ACTIVE_SUBSCRIPTION_STATUSES: ReadonlyArray<SubStatus> = ['ACTIVE', 'TRIALING'];

const ACTIVE_STATUS_SET: ReadonlySet<SubStatus> = new Set(ACTIVE_SUBSCRIPTION_STATUSES);

export interface OrgWithRelations {
  subscriptions: ReadonlyArray<{ app: AppType; status: SubStatus }>;
  appAccess: ReadonlyArray<{ app: AppType; enabled: boolean }>;
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
  const apps = org.appAccess
    .filter((a) => a.enabled)
    .map((a) => a.app)
    .filter((app) => (app === 'CONDUCTOR' ? conductorActive(org) : true));
  return Array.from(new Set(apps)).sort((a, b) => a.localeCompare(b));
}
