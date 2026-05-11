import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

/**
 * GET /api/workspaces
 *
 * Returns all workspaces the current user belongs to.
 * Auto-creates a personal workspace on first visit if none exist.
 * Respects the orbit_workspace cookie for current workspace selection.
 */
export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the selected workspace from cookie
    const cookieStore = await cookies();
    const selectedWorkspaceId = cookieStore.get("orbit_workspace")?.value;

    // Find all workspaces this user is a member of
    let memberships = await db.member.findMany({
      where: { clerkUserId: userId },
      include: {
        org: {
          include: {
            subscriptions: { where: { status: { in: ["ACTIVE", "TRIALING"] } } },
          },
        },
      },
    });

    // Auto-create personal workspace if user has none
    if (memberships.length === 0) {
      const org = await db.organization.create({
        data: {
          name: "My Workspace",
          slug: `ws-${userId.slice(-8).toLowerCase()}`,
          members: {
            create: {
              clerkUserId: userId,
              role: "OWNER",
            },
          },
          subscriptions: {
            create: [
              { app: "WORKPIPE", plan: "FREE", status: "ACTIVE" },
              { app: "DRIVE", plan: "FREE", status: "ACTIVE" },
            ],
          },
          appAccess: {
            create: [
              { app: "WORKPIPE", enabled: true },
              { app: "DRIVE", enabled: true },
            ],
          },
        },
        include: {
          members: { where: { clerkUserId: userId } },
          subscriptions: { where: { status: { in: ["ACTIVE", "TRIALING"] } } },
        },
      });

      memberships = [{ ...org.members[0], org }];
    }

    const workspaces = memberships.map((m: any) => ({
      id: m.org.id,
      name: m.org.name,
      slug: m.org.slug,
      role: m.role,
      plan: m.org.subscriptions[0]?.plan || "FREE",
    }));

    // Find the selected workspace, or default to first
    let current = workspaces[0];
    if (selectedWorkspaceId) {
      const selected = workspaces.find((ws) => ws.id === selectedWorkspaceId);
      if (selected) {
        current = selected;
      }
    }

    return NextResponse.json({
      workspaces,
      current,
    });
  } catch (error) {
    console.error("[Workspaces]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
