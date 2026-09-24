import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

/**
 * GET /api/debug/me
 *
 * Debug endpoint to verify user's access and membership data.
 * Returns all relevant info for diagnosing access issues.
 */
export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const clerkUser = await currentUser();
    const cookieStore = await cookies();
    const savedWorkspace = cookieStore.get("orbit_workspace")?.value;

    // Get all memberships for this user
    const memberships = await db.member.findMany({
      where: { clerkUserId: userId },
      include: {
        org: {
          include: {
            subscriptions: true,
            appAccess: true,
            members: {
              select: {
                id: true,
                email: true,
                name: true,
                role: true,
              },
            },
          },
        },
      },
    });

    // Calculate what access this user should have for each org
    const orgsWithAccess = memberships.map((m) => {
      const isPlatformAdmin = m.role === "OWNER" || m.role === "ADMIN";
      const appAccess = isPlatformAdmin
        ? ["WORKPIPE", "ATRIUM", "DRIVE"]
        : m.org.appAccess.filter((a) => a.enabled).map((a) => a.app);

      const effectiveSubscriptions = isPlatformAdmin && m.org.subscriptions.length === 0
        ? [{ plan: "ENTERPRISE", status: "ACTIVE", note: "Admin bypass - no actual subscription" }]
        : m.org.subscriptions.map((s) => ({ plan: s.plan, status: s.status, app: s.app }));

      return {
        membership: {
          id: m.id,
          role: m.role,
          email: m.email,
          name: m.name,
        },
        org: {
          id: m.org.id,
          name: m.org.name,
          slug: m.org.slug,
          memberCount: m.org.members.length,
        },
        subscriptions: m.org.subscriptions,
        appAccessRecords: m.org.appAccess,
        computed: {
          isPlatformAdmin,
          effectiveAppAccess: appAccess,
          effectiveSubscriptions,
          canAccessAtrium: appAccess.includes("ATRIUM"),
          canAccessWorkPipe: appAccess.includes("WORKPIPE"),
          canAccessDrive: appAccess.includes("DRIVE"),
        },
      };
    });

    return NextResponse.json({
      clerk: {
        userId,
        email: clerkUser?.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)?.emailAddress,
        name: [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(" "),
      },
      currentWorkspaceCookie: savedWorkspace,
      memberships: orgsWithAccess,
      summary: {
        totalOrgs: memberships.length,
        isOwnerOrAdminAnywhere: memberships.some((m) => m.role === "OWNER" || m.role === "ADMIN"),
      },
    });
  } catch (error) {
    console.error("[Debug Me]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
