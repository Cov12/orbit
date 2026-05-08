import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * DELETE /api/workspaces/[id]/invites/[inviteId]
 *
 * Revoke a pending invite.
 * Requires OWNER or ADMIN role.
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; inviteId: string }> }
) {
  try {
    const { userId } = await auth();
    const { id: orgId, inviteId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user is OWNER or ADMIN of this org
    const member = await db.member.findFirst({
      where: { clerkUserId: userId, orgId },
    });

    if (!member || (member.role !== "OWNER" && member.role !== "ADMIN")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Find and delete the invite
    const invite = await db.invite.findFirst({
      where: { id: inviteId, orgId },
    });

    if (!invite) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }

    await db.invite.delete({
      where: { id: inviteId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Invite DELETE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
