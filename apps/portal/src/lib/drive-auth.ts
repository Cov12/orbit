import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

type DriveContext = {
  userId: string;
  clerkOrgId: string;
  orgId: string;
};

export async function getDriveContext(): Promise<DriveContext> {
  const { userId, orgId } = await auth();

  if (!userId) {
    throw new Error("UNAUTHORIZED");
  }

  if (!orgId) {
    throw new Error("NO_ORG");
  }

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

  return {
    userId,
    clerkOrgId: orgId,
    orgId: org.id,
  };
}
