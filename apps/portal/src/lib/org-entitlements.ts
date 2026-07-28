import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { getAppEntitlementMap, type AppEntitlementMap } from "@/lib/entitlements";
import { isLicenseActive } from "@/lib/license";
import type { AppType, SubStatus } from "@prisma/client";

export interface CurrentOrgEntitlements {
  orgId: string;
  orgName: string;
  role: string;
  isPlatformAdmin: boolean;
  /** Per-app entitlement, mirrors exactly what the signed JWT grants. */
  appStatus: AppEntitlementMap;
  /** Active/trialing subscriptions on the org, for plan-label display. */
  subscriptions: Array<{ app: AppType; plan: string; status: SubStatus }>;
}

/**
 * Resolve the caller's current workspace and its effective app entitlements.
 *
 * This is the ONE place that (a) picks the selected workspace from the
 * `orbit_workspace` cookie (falling back to the caller's first membership) and
 * (b) computes per-app status via getAppEntitlementMap. Every entitlement UI —
 * the dashboard, the apps grid, and each per-app landing page — goes through
 * here so they can never disagree with each other or with the JWT.
 *
 * Returns null when unauthenticated or the caller has no org membership.
 */
export async function getCurrentOrgEntitlements(): Promise<CurrentOrgEntitlements | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const cookieStore = await cookies();
  const selectedWorkspaceId = cookieStore.get("orbit_workspace")?.value;

  const include = {
    appAccess: true,
    subscriptions: {
      where: { status: { in: ["ACTIVE" as const, "TRIALING" as const] } },
    },
  };

  let member = selectedWorkspaceId
    ? await db.member.findFirst({
        where: { clerkUserId: userId, orgId: selectedWorkspaceId },
        include: { org: { include } },
      })
    : null;

  if (!member) {
    member = await db.member.findFirst({
      where: { clerkUserId: userId },
      include: { org: { include } },
    });
  }

  if (!member?.org) return null;

  const isPlatformAdmin = member.role === "OWNER" || member.role === "ADMIN";

  return {
    orgId: member.org.id,
    orgName: member.org.name,
    role: member.role,
    isPlatformAdmin,
    appStatus: getAppEntitlementMap(member.org, isPlatformAdmin, isLicenseActive()),
    subscriptions: member.org.subscriptions.map((s) => ({
      app: s.app,
      plan: s.plan,
      status: s.status,
    })),
  };
}
