import { getPortalContext } from "@/lib/auth";
import type { PortalJwtPayload } from "@/lib/portal-jwt";
import { db } from "@/lib/db";

type DriveContext = {
  userId: string;
  orgId: string;
  /** Active sub-account scoped to orgId. null = business scope. */
  subAccountId: string | null;
  memberRole: string;
};

/**
 * Resolve the active sub-account from the Portal JWT, strictly scoped to the
 * resolved workspace. The claim is honored ONLY when it was minted for this same
 * org (`payload.org_id === orgId`) AND names an ACTIVE sub-account belonging to
 * it. A stale/cross-org claim (e.g. when a multi-org user selected a different
 * org via X-Org-Id) resolves to null = business scope — never leaks across orgs.
 */
async function resolveActiveSubAccountId(
  orgId: string,
  payload: PortalJwtPayload,
): Promise<string | null> {
  const claim = payload.sub_account_id;
  if (!claim || payload.org_id !== orgId) return null;
  const sub = await db.subAccount.findFirst({
    where: { id: claim, orgId, status: "ACTIVE" },
    select: { id: true },
  });
  return sub?.id ?? null;
}

/**
 * Check if the org has Drive access via subscription/app access.
 * Phase 1: Always returns true (no subscription wall).
 * Phase 2: Check AppAccess table for DRIVE + active subscription.
 */
async function checkDriveAccess(orgId: string): Promise<boolean> {
  // TODO: Phase 2 — uncomment to enforce subscription
  // const access = await db.appAccess.findUnique({
  //   where: { orgId_app: { orgId, app: "DRIVE" } },
  // });
  // if (!access?.enabled) return false;
  //
  // const sub = await db.subscription.findUnique({
  //   where: { orgId },
  // });
  // if (!sub || sub.status !== "ACTIVE") return false;

  // Phase 1: All authenticated org members get Drive access
  return true;
}

/**
 * Get Drive context for authenticated requests.
 * 
 * Auth flow (decoupled from Clerk's org layer):
 * 1. Clerk provides userId (authentication only — "who are you?")
 * 2. DB Member table maps userId → org (authorization — "what can you access?")
 * 3. This keeps org management in our DB, not Clerk's
 * 
 * If user belongs to multiple orgs, uses X-Org-Id header to select.
 * If user belongs to one org, auto-selects it.
 */
export async function getDriveContext(req?: Request): Promise<DriveContext> {
  const payload = await getPortalContext();

  if (!payload) {
    throw new Error("UNAUTHORIZED");
  }

  const userId = payload.sub;

  // Look up user's org memberships from our DB (not Clerk)
  const memberships = await db.member.findMany({
    where: { clerkUserId: userId },
    include: { org: true },
  });

  if (memberships.length === 0) {
    throw new Error("NO_ORG");
  }

  let membership;

  if (memberships.length === 1) {
    // Single org — auto-select
    membership = memberships[0];
  } else {
    // Multiple orgs — check X-Org-Id header
    const requestedOrgId = req?.headers.get("x-org-id");
    if (!requestedOrgId) {
      throw new Error("MULTI_ORG_SELECT_REQUIRED");
    }
    membership = memberships.find((m: typeof memberships[0]) => m.orgId === requestedOrgId);
    if (!membership) {
      throw new Error("FORBIDDEN");
    }
  }

  // Check subscription/access (Phase 1: always passes)
  const hasAccess = await checkDriveAccess(membership.orgId);
  if (!hasAccess) {
    throw new Error("DRIVE_ACCESS_DENIED");
  }

  const subAccountId = await resolveActiveSubAccountId(membership.orgId, payload);

  return {
    userId,
    orgId: membership.orgId,
    subAccountId,
    memberRole: membership.role,
  };
}
