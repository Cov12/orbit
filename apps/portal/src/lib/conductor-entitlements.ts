import { db } from "@/lib/db";
import { getEffectiveAppAccessEntries } from "@/lib/entitlements";
import { isOrgLicensed } from "@/lib/license";
import type { AppType, SubStatus } from "@prisma/client";

type OrgEntitlementSnapshot = {
  id: string;
  licensed: boolean;
  subscriptions: Array<{ app: AppType; status: SubStatus }>;
  appAccess: Array<{ app: AppType; enabled: boolean }>;
};

async function loadOrgEntitlementSnapshot(orgId: string): Promise<OrgEntitlementSnapshot | null> {
  return db.organization.findUnique({
    where: { id: orgId },
    select: {
      id: true,
      licensed: true,
      subscriptions: { select: { app: true, status: true } },
      appAccess: { select: { app: true, enabled: true } },
    },
  });
}

export async function postConductorEntitlements(orgId: string): Promise<void> {
  const conductorBaseUrl = process.env.CONDUCTOR_URL || process.env.NEXT_PUBLIC_CONDUCTOR_URL;
  const sharedSecret = process.env.ORBIT_PORTAL_JWT_SECRET;

  if (!conductorBaseUrl) {
    console.warn("[Entitlements Sync] Skipped: missing CONDUCTOR_URL/NEXT_PUBLIC_CONDUCTOR_URL");
    return;
  }
  if (!sharedSecret) {
    console.warn("[Entitlements Sync] Skipped: missing ORBIT_PORTAL_JWT_SECRET");
    return;
  }

  const org = await loadOrgEntitlementSnapshot(orgId);
  if (!org) {
    console.warn(`[Entitlements Sync] Skipped: org not found for ${orgId}`);
    return;
  }

  const appAccess = getEffectiveAppAccessEntries(org, isOrgLicensed(org));
  if (appAccess.length === 0) {
    console.warn(`[Entitlements Sync] Skipped: effective appAccess empty for ${orgId}`);
    return;
  }

  try {
    const url = new URL("/api/webhooks/portal/entitlements", conductorBaseUrl).toString();
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-orbit-bridge-secret": sharedSecret,
      },
      body: JSON.stringify({ org_id: org.id, appAccess }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(
        `[Entitlements Sync] Conductor webhook failed (${res.status}) for ${orgId}${text ? `: ${text}` : ""}`
      );
    }
  } catch (error) {
    console.error(`[Entitlements Sync] Conductor webhook request failed for ${orgId}:`, error);
  }
}
