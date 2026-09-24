import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { isOrgLicensed } from "@/lib/license";

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
    const memberships = await db.member.findMany({
      where: { clerkUserId: userId },
      include: { org: true },
    });

    // No auto-create: a user with no workspace is routed to the mandatory
    // onboarding wizard (enforced in the portal layout). Return an empty list so
    // the client can detect the no-workspace state.
    if (memberships.length === 0) {
      return NextResponse.json({
        workspaces: [],
        current: null,
        licensed: isOrgLicensed(null),
      });
    }

    const workspaces = memberships.map((m) => ({
      id: m.org.id,
      name: m.org.name,
      slug: m.org.slug,
      role: m.role,
    }));

    // Find the selected workspace, or default to first
    let current = workspaces[0];
    if (selectedWorkspaceId) {
      const selected = workspaces.find((ws) => ws.id === selectedWorkspaceId);
      if (selected) {
        current = selected;
      }
    }

    // License applies to the *current* workspace: the global env switch (on by
    // default) OR that org's per-org `licensed` flag.
    const currentOrg =
      memberships.find((m) => m.org.id === current.id)?.org ?? null;

    return NextResponse.json({
      workspaces,
      current,
      licensed: isOrgLicensed(currentOrg),
    });
  } catch (error) {
    console.error("[Workspaces]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
