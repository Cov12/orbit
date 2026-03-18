import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

type DriveContext = {
  userId: string;
  clerkOrgId: string;
  orgId: string;
};

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

export async function getDriveContext(): Promise<DriveContext> {
  const { userId, orgId } = await auth();

  if (!userId) {
    throw new Error("UNAUTHORIZED");
  }

  if (!orgId) {
    throw new Error("NO_ORG");
  }

  // Verify org exists and user is a member
  const org = await db.organization.findUnique({
    where: { clerkOrgId: orgId },
    include: {
      members: {
        where: { clerkUserId: userId },
        take: 1,
      },
    },
  });

  if (!org || org.members.length === 0) {
    throw new Error("FORBIDDEN");
  }

  // Check subscription/access (Phase 1: always passes)
  const hasAccess = await checkDriveAccess(org.id);
  if (!hasAccess) {
    throw new Error("DRIVE_ACCESS_DENIED");
  }

  return {
    userId,
    clerkOrgId: orgId,
    orgId: org.id,
  };
}
