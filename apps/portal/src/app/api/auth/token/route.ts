import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { signOrbitToken } from "@/lib/jwt";
import { getEffectiveAppAccess } from "@/lib/entitlements";
import { resolveActiveSubAccountId } from "@/lib/subaccount";
import { logEntitlementDecision, logTokenExchange } from "@/lib/audit";

/**
 * POST /api/auth/token
 *
 * Issues a Orbit JWT for cross-app authentication.
 * Called by WorkPipe, Drive, Atrium, and Conductor to get a token for the current user.
 *
 * Workspace resolution order:
 * 1. Request body `workspace_id`
 * 2. `orbit_workspace` cookie (set by workspace switcher)
 * 3. User's first workspace (fallback)
 *
 * Optional `aud` body param: when `aud === 'conductor'`, requires CONDUCTOR entitlement.
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
    const requestedAud: string | undefined =
      typeof body.aud === "string" ? body.aud : undefined;

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

    // Resolve the active sub-account (scoped to this workspace; null = business scope).
    // Order: explicit body `sub_account_id` → `orbit_subaccount` cookie → null.
    const subAccountCookie = (await cookies()).get("orbit_subaccount")?.value;
    const requestedSubAccount =
      typeof body.sub_account_id === "string" ? body.sub_account_id : undefined;
    const subAccountId = await resolveActiveSubAccountId(
      org.id,
      requestedSubAccount ?? subAccountCookie
    );

    // Always fetch from Clerk — source of truth for email/name.
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

    // Platform admins (OWNER/ADMIN) get access to all apps regardless of subscription
    const isPlatformAdmin = member.role === "OWNER" || member.role === "ADMIN";
    const appAccess = getEffectiveAppAccess(org, isPlatformAdmin);

    if (requestedAud === "conductor" && !appAccess.includes("CONDUCTOR")) {
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
      requestedAud ? { aud: requestedAud } : undefined
    );

    logTokenExchange({
      orgId: org.id,
      userId,
      app: requestedAud === "conductor" ? "CONDUCTOR" : "PORTAL",
      aud: requestedAud,
      outcome: "success",
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
