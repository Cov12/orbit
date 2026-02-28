import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { signOrbitToken } from "@/lib/jwt";

/**
 * POST /api/auth/token
 *
 * Issues a Orbit JWT for cross-app authentication.
 * Called by WorkPipe and Atrium to get a token for the current user.
 *
 * Requires: Clerk session (user must be logged in to portal)
 * Returns: { token: string } — signed JWT with org, role, subscriptions, app_access
 */
export async function POST(req: Request) {
  try {
    const { userId, orgId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse optional org_slug from body (for users with multiple orgs)
    const body = await req.json().catch(() => ({}));
    const requestedOrgSlug = body.org_slug;

    // Find the organization
    let org;
    if (requestedOrgSlug) {
      org = await db.organization.findUnique({
        where: { slug: requestedOrgSlug },
        include: {
          members: { where: { clerkUserId: userId } },
          subscriptions: { where: { status: { in: ["ACTIVE", "TRIALING"] } } },
          appAccess: { where: { enabled: true } },
        },
      });
    } else if (orgId) {
      org = await db.organization.findUnique({
        where: { clerkOrgId: orgId },
        include: {
          members: { where: { clerkUserId: userId } },
          subscriptions: { where: { status: { in: ["ACTIVE", "TRIALING"] } } },
          appAccess: { where: { enabled: true } },
        },
      });
    }

    if (!org || org.members.length === 0) {
      return NextResponse.json(
        { error: "No organization found or user is not a member" },
        { status: 403 }
      );
    }

    const member = org.members[0];

    const token = signOrbitToken({
      sub: userId,
      org_id: org.id,
      org_slug: org.slug,
      role: member.role,
      subscriptions: org.subscriptions.map((s: any) => ({
        plan: s.plan,
        status: s.status,
      })),
      app_access: org.appAccess.map((a: any) => a.app),
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
