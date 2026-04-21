import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { signOrbitToken } from "@/lib/jwt";

/**
 * POST /api/auth/token
 *
 * Issues a Orbit JWT for cross-app authentication.
 * Called by WorkPipe, Drive, and Atrium to get a token for the current user.
 *
 * Workspace resolution order:
 * 1. Request body `workspace_id`
 * 2. `orbit_workspace` cookie (set by workspace switcher)
 * 3. User's first workspace (fallback)
 *
 * Requires: Clerk session (user must be logged in to Portal)
 * Returns: { token: string } — signed JWT with org, role, subscriptions, app_access
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const requestedWorkspaceId = body.workspace_id;

    // Resolve workspace
    let org;
    const includeRelations = {
      members: { where: { clerkUserId: userId } },
      subscriptions: { where: { status: { in: ["ACTIVE" as const, "TRIALING" as const] } } },
      appAccess: { where: { enabled: true } },
    };

    if (requestedWorkspaceId) {
      // Explicit workspace requested
      org = await db.organization.findUnique({
        where: { id: requestedWorkspaceId },
        include: includeRelations,
      });
    }

    if (!org) {
      // Try cookie
      const cookieStore = await cookies();
      const savedWorkspace = cookieStore.get("orbit_workspace")?.value;
      if (savedWorkspace) {
        org = await db.organization.findUnique({
          where: { id: savedWorkspace },
          include: includeRelations,
        });
      }
    }

    if (!org) {
      // Fallback: user's first workspace
      const firstMembership = await db.member.findFirst({
        where: { clerkUserId: userId },
        include: {
          org: { include: includeRelations },
        },
      });
      org = firstMembership?.org;
    }

    if (!org || org.members.length === 0) {
      return NextResponse.json(
        { error: "No workspace found. Please create one from the Portal dashboard." },
        { status: 403 }
      );
    }

    const member = org.members[0];

    // Always fetch from Clerk — source of truth for email/name.
    const clerkUser = await currentUser();
    const email = clerkUser?.emailAddresses.find((entry) => entry.id === clerkUser.primaryEmailAddressId)?.emailAddress || member.email;
    const name = [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(" ") || member.name;

    if (!email || !name) {
      return NextResponse.json({ error: "Unable to resolve user profile" }, { status: 500 });
    }

    // Platform admins (OWNER/ADMIN) get access to all apps regardless of subscription
    const isPlatformAdmin = member.role === "OWNER" || member.role === "ADMIN";
    const appAccess = isPlatformAdmin
      ? ["WORKPIPE", "ATRIUM", "DRIVE"]
      : org.appAccess.map((a: any) => a.app);

    const subscriptions = isPlatformAdmin && org.subscriptions.length === 0
      ? [{ plan: "ENTERPRISE", status: "ACTIVE" }]
      : org.subscriptions.map((s: any) => ({ plan: s.plan, status: s.status }));

    const token = signOrbitToken({
      sub: userId,
      email,
      name,
      org_id: org.id,
      org_slug: org.slug,
      role: member.role,
      subscriptions,
      app_access: appAccess,
    });

    return NextResponse.json({ token });
  } catch (error) {
    console.error("[Orbit Token]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
