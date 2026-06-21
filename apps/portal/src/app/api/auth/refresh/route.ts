import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { signOrbitToken } from "@/lib/jwt";
import { getEffectiveAppAccess } from "@/lib/entitlements";
import { resolveActiveSubAccountId } from "@/lib/subaccount";
import { logEntitlementDecision, logTokenExchange } from "@/lib/audit";

/**
 * GET /api/auth/refresh?redirect_uri=<url>
 *
 * Silent token refresh for downstream apps (WorkPipe, Drive, Atrium, Conductor).
 *
 * Flow:
 * 1. App's JWT expires → redirects user here with redirect_uri
 * 2. Portal checks if user has an active Clerk session (or whatever provider)
 * 3. If authenticated → issues fresh JWT → redirects back to app's /auth/callback?token=<jwt>
 * 4. If not authenticated → redirects to Portal sign-in with return_url back to this endpoint
 *
 * When the redirect_uri origin matches NEXT_PUBLIC_CONDUCTOR_URL, the issued JWT
 * carries `aud='conductor'` and the caller must hold the CONDUCTOR entitlement.
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
    process.env.NEXT_PUBLIC_DRIVE_URL,
    process.env.NEXT_PUBLIC_ATRIUM_URL,
    process.env.NEXT_PUBLIC_CONDUCTOR_URL,
    process.env.NEXT_PUBLIC_APP_URL,
  ].filter((u): u is string => Boolean(u)).map((u) => new URL(u).origin);

  const redirectOrigin = new URL(redirectUri).origin;
  const isAllowed = allowedOrigins.includes(redirectOrigin);

  if (!isAllowed) {
    return NextResponse.json({ error: "Invalid redirect_uri" }, { status: 400 });
  }

  const conductorOrigin = process.env.NEXT_PUBLIC_CONDUCTOR_URL
    ? new URL(process.env.NEXT_PUBLIC_CONDUCTOR_URL).origin
    : null;
  const derivedAud: string | undefined =
    conductorOrigin && redirectOrigin === conductorOrigin ? "conductor" : undefined;

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

    // Always fetch from Clerk — Clerk is source of truth for email/name.
    // Member.email can drift (stale seeds, manual edits). Fall back to member only if Clerk lookup fails.
    const clerkUser = await currentUser();
    const email = clerkUser?.emailAddresses.find((entry) => entry.id === clerkUser.primaryEmailAddressId)?.emailAddress || member.email;

    // Email is the only hard requirement. A user without a Clerk display name
    // (e.g. an email-only signup) must not be locked out of every app — fall back
    // to the email local-part as the display name.
    if (!email) {
      return NextResponse.json({ error: "Unable to resolve user profile" }, { status: 500 });
    }
    const name =
      [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(" ").trim() ||
      member.name ||
      email.split("@")[0];

    // Sync Member record if Clerk email/name has drifted from stored value.
    if (member.email !== email || member.name !== name) {
      await db.member.update({
        where: { id: member.id },
        data: { email, name },
      }).catch((err: unknown) => console.error("[Portal] Member sync failed:", err));
    }

    // Platform admins (OWNER/ADMIN) get access to all apps regardless of subscription
    const isPlatformAdmin = member.role === "OWNER" || member.role === "ADMIN";
    const appAccess = getEffectiveAppAccess(org, isPlatformAdmin);

    if (derivedAud === "conductor" && !appAccess.includes("CONDUCTOR")) {
      logEntitlementDecision({
        orgId: org.id,
        userId,
        app: "CONDUCTOR",
        decision: "denied",
        reason: "conductor_entitlement_missing",
      });
      return NextResponse.json(
        { error: "Conductor entitlement required" },
        { status: 403 }
      );
    }

    const subscriptions = isPlatformAdmin && org.subscriptions.length === 0
      ? [{ plan: "ENTERPRISE", status: "ACTIVE" }]
      : org.subscriptions.map((s: any) => ({ plan: s.plan, status: s.status }));

    // Resolve the active sub-account from the cookie, scoped to this workspace
    // (null = business scope; a stale cross-org cookie resolves to null).
    const subAccountId = await resolveActiveSubAccountId(
      org.id,
      cookieStore.get("orbit_subaccount")?.value
    );

    const token = signOrbitToken(
      {
        sub: userId,
        email,
        name,
        org_id: org.id,
        org_slug: org.slug,
        sub_account_id: subAccountId,
        role: member.role,
        subscriptions,
        app_access: appAccess,
      },
      derivedAud ? { aud: derivedAud } : undefined
    );

    logTokenExchange({
      orgId: org.id,
      userId,
      app: derivedAud === "conductor" ? "CONDUCTOR" : "PORTAL",
      aud: derivedAud,
      outcome: "success",
    });

    // Redirect back to the app's callback with the fresh token
    const separator = redirectUri.includes("?") ? "&" : "?";
    return NextResponse.redirect(`${redirectUri}${separator}token=${token}`);
  } catch (error) {
    console.error("[Auth Refresh]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
