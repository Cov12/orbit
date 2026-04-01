import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { signOrbitToken } from "@/lib/jwt";

/**
 * GET /api/auth/refresh?redirect_uri=<url>
 *
 * Silent token refresh for downstream apps (WorkPipe, Drive, Atrium).
 *
 * Flow:
 * 1. App's JWT expires → redirects user here with redirect_uri
 * 2. Portal checks if user has an active Clerk session (or whatever provider)
 * 3. If authenticated → issues fresh JWT → redirects back to app's /auth/callback?token=<jwt>
 * 4. If not authenticated → redirects to Portal sign-in with return_url back to this endpoint
 *
 * This is the ONLY place that touches the auth provider (Clerk today).
 * Downstream apps never interact with Clerk directly.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const redirectUri = url.searchParams.get("redirect_uri");

  if (!redirectUri) {
    return NextResponse.json({ error: "Missing redirect_uri" }, { status: 400 });
  }

  // Validate redirect_uri is a known app domain (security: prevent open redirect)
  const allowedOrigins = [
    process.env.NEXT_PUBLIC_WORKPIPE_URL,
    process.env.NEXT_PUBLIC_DRIVE_URL?.replace("/drive", ""),
    process.env.NEXT_PUBLIC_ATRIUM_URL,
  ].filter(Boolean);

  const redirectOrigin = new URL(redirectUri).origin;
  const isAllowed = allowedOrigins.some((origin) => origin && redirectOrigin === new URL(origin).origin);

  if (!isAllowed) {
    return NextResponse.json({ error: "Invalid redirect_uri" }, { status: 400 });
  }

  try {
    const { userId } = await auth();

    if (!userId) {
      // User is not authenticated — send to Portal sign-in
      // After sign-in, Clerk redirects back here, which then issues the JWT
      const portalUrl = process.env.NEXT_PUBLIC_APP_URL || "https://portal.orbit.example";
      const returnUrl = `${portalUrl}/api/auth/refresh?redirect_uri=${encodeURIComponent(redirectUri)}`;
      const signInUrl = `${portalUrl}/sign-in?redirect_url=${encodeURIComponent(returnUrl)}`;
      return NextResponse.redirect(signInUrl);
    }

    // User is authenticated — resolve workspace and issue token
    const cookieStore = await cookies();
    const savedWorkspace = cookieStore.get("orbit_workspace")?.value;

    const includeRelations = {
      members: { where: { clerkUserId: userId } },
      subscriptions: { where: { status: { in: ["ACTIVE" as const, "TRIALING" as const] } } },
      appAccess: { where: { enabled: true } },
    };

    let org;

    if (savedWorkspace) {
      org = await db.organization.findUnique({
        where: { id: savedWorkspace },
        include: includeRelations,
      });
    }

    if (!org) {
      const firstMembership = await db.member.findFirst({
        where: { clerkUserId: userId },
        include: { org: { include: includeRelations } },
      });
      org = firstMembership?.org;
    }

    if (!org || org.members.length === 0) {
      // User exists but has no workspace — send to Portal dashboard to create one
      const portalUrl = process.env.NEXT_PUBLIC_APP_URL || "https://portal.orbit.example";
      return NextResponse.redirect(`${portalUrl}/dashboard?setup=true`);
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

    // Redirect back to the app's callback with the fresh token
    const separator = redirectUri.includes("?") ? "&" : "?";
    return NextResponse.redirect(`${redirectUri}${separator}token=${token}`);
  } catch (error) {
    console.error("[Auth Refresh]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
