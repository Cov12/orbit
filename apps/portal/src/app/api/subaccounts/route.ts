import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { verifyOrbitToken } from "@/lib/jwt";
import { uniqueSubAccountSlug } from "@/lib/subaccount";

/**
 * Resolve the workspace this request targets: explicit `?workspace_id=` / body
 * `workspaceId`, else the `orbit_workspace` cookie. Returns null when none is set.
 */
async function resolveWorkspaceId(explicit?: string): Promise<string | null> {
  if (explicit) return explicit;
  const cookieStore = await cookies();
  return cookieStore.get("orbit_workspace")?.value ?? null;
}

/**
 * GET /api/subaccounts[?workspace_id=<id>]
 *
 * Lists the ACTIVE sub-accounts for an org. Two callers:
 *
 *  1. Service-to-service — another Orbit app (WorkPipe, Atrium, …) calls with
 *     its Orbit JWT as a Bearer token. The signed token's `org_id` is both the
 *     authentication and the scope, so no Clerk session is needed. This is the
 *     canonical cross-app read of sub-account identity (Portal is the source of
 *     truth; apps consume it).
 *  2. Interactive — the in-app switcher, authenticated by the Clerk session and
 *     the `orbit_workspace` cookie / `?workspace_id=`.
 */
export async function GET(req: Request) {
  try {
    // (1) Service-to-service via Orbit JWT bearer.
    const authz = req.headers.get("authorization");
    if (authz?.startsWith("Bearer ")) {
      let orgId: string | null = null;
      try {
        orgId = verifyOrbitToken(authz.slice(7))?.org_id ?? null;
      } catch {
        orgId = null;
      }
      if (!orgId) {
        return NextResponse.json({ error: "Invalid token" }, { status: 401 });
      }
      const subAccounts = await db.subAccount.findMany({
        where: { orgId, status: "ACTIVE" },
        select: { id: true, name: true, slug: true, status: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      });
      return NextResponse.json({ subAccounts });
    }

    // (2) Interactive via Clerk session.
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const orgId = await resolveWorkspaceId(url.searchParams.get("workspace_id") ?? undefined);
    if (!orgId) {
      return NextResponse.json({ error: "No workspace selected" }, { status: 400 });
    }

    const member = await db.member.findFirst({
      where: { clerkUserId: userId, orgId },
      select: { id: true },
    });
    if (!member) {
      return NextResponse.json({ error: "Not a member of this workspace" }, { status: 403 });
    }

    const subAccounts = await db.subAccount.findMany({
      where: { orgId, status: "ACTIVE" },
      select: { id: true, name: true, slug: true, status: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ subAccounts });
  } catch (error) {
    console.error("[Sub-accounts List]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/subaccounts
 * Body: { name: string, workspaceId?: string }
 *
 * Creates a sub-account in the current workspace. Requires OWNER or ADMIN.
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const name: string | undefined =
      typeof body.name === "string" ? body.name.trim() : undefined;

    if (!name) {
      return NextResponse.json({ error: "Sub-account name is required" }, { status: 400 });
    }

    const orgId = await resolveWorkspaceId(
      typeof body.workspaceId === "string" ? body.workspaceId : undefined
    );
    if (!orgId) {
      return NextResponse.json({ error: "No workspace selected" }, { status: 400 });
    }

    // Only workspace OWNER/ADMIN may create sub-accounts
    const member = await db.member.findFirst({
      where: { clerkUserId: userId, orgId },
      select: { role: true },
    });
    if (!member) {
      return NextResponse.json({ error: "Not a member of this workspace" }, { status: 403 });
    }
    if (member.role !== "OWNER" && member.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Only workspace owners or admins can create sub-accounts" },
        { status: 403 }
      );
    }

    const slug = await uniqueSubAccountSlug(orgId, name);

    const subAccount = await db.subAccount.create({
      data: { orgId, name, slug },
      select: { id: true, name: true, slug: true, status: true, createdAt: true },
    });

    return NextResponse.json({ subAccount }, { status: 201 });
  } catch (error) {
    console.error("[Sub-account Create]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
