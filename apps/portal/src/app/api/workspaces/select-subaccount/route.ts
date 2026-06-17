import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cookies } from "next/headers";

/**
 * POST /api/workspaces/select-subaccount
 *
 * Stores the user's active sub-account (sub-workspace) in the `orbit_subaccount` cookie.
 * Pass `{ subAccountId: null }` to clear it and return to business scope.
 *
 * The sub-account must belong to the user's current workspace (resolved from
 * `workspaceId` body param or the `orbit_workspace` cookie), and the user must be a
 * member of that workspace — otherwise we never set the cookie.
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const subAccountId: string | null =
      typeof body.subAccountId === "string" ? body.subAccountId : null;

    const cookieStore = await cookies();
    const workspaceId: string | undefined =
      (typeof body.workspaceId === "string" ? body.workspaceId : undefined) ??
      cookieStore.get("orbit_workspace")?.value;

    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace selected" }, { status: 400 });
    }

    // Verify the user is a member of this workspace
    const member = await db.member.findFirst({
      where: { clerkUserId: userId, orgId: workspaceId },
      select: { id: true },
    });

    if (!member) {
      return NextResponse.json({ error: "Not a member of this workspace" }, { status: 403 });
    }

    // Clearing the selection → back to business scope
    if (!subAccountId) {
      cookieStore.delete("orbit_subaccount");
      return NextResponse.json({ selected: null });
    }

    // The sub-account must belong to this workspace and be active
    const subAccount = await db.subAccount.findFirst({
      where: { id: subAccountId, orgId: workspaceId, status: "ACTIVE" },
      select: { id: true },
    });

    if (!subAccount) {
      return NextResponse.json(
        { error: "Sub-account not found in this workspace" },
        { status: 404 }
      );
    }

    cookieStore.set("orbit_subaccount", subAccountId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365, // 1 year
      path: "/",
    });

    return NextResponse.json({ selected: subAccountId });
  } catch (error) {
    console.error("[Sub-account Select]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
