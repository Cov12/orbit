import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cookies } from "next/headers";

/**
 * POST /api/workspaces/select
 *
 * Stores the user's selected workspace in a cookie.
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { workspaceId } = await req.json();

    // Verify user is a member of this workspace
    const member = await db.member.findFirst({
      where: { clerkUserId: userId, orgId: workspaceId },
    });

    if (!member) {
      return NextResponse.json({ error: "Not a member of this workspace" }, { status: 403 });
    }

    // Store selection in cookie
    const cookieStore = await cookies();
    cookieStore.set("orbit_workspace", workspaceId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365, // 1 year
      path: "/",
    });

    // Switching workspace resets the active sub-account: a sub-account is org-scoped,
    // so a stale selection from the previous workspace must never carry over.
    cookieStore.delete("orbit_subaccount");

    return NextResponse.json({ selected: workspaceId });
  } catch (error) {
    console.error("[Workspace Select]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
