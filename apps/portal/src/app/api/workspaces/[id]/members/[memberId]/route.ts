import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * PATCH /api/workspaces/[id]/members/[memberId]
 *
 * Update a member's role.
 * Requires OWNER or ADMIN role (and cannot demote OWNER).
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const { userId } = await auth();
    const { id: orgId, memberId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role } = await req.json();

    if (!["MEMBER", "ADMIN"].includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    // Verify current user is OWNER or ADMIN
    const currentMember = await db.member.findFirst({
      where: { clerkUserId: userId, orgId },
    });

    if (!currentMember || (currentMember.role !== "OWNER" && currentMember.role !== "ADMIN")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get target member
    const targetMember = await db.member.findFirst({
      where: { id: memberId, orgId },
    });

    if (!targetMember) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Cannot change OWNER's role
    if (targetMember.role === "OWNER") {
      return NextResponse.json({ error: "Cannot change owner's role" }, { status: 400 });
    }

    // Only OWNER can promote to ADMIN
    if (role === "ADMIN" && currentMember.role !== "OWNER") {
      return NextResponse.json({ error: "Only owner can promote to admin" }, { status: 403 });
    }

    // Update role
    const updated = await db.member.update({
      where: { id: memberId },
      data: { role },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    return NextResponse.json({ member: updated });
  } catch (error) {
    console.error("[Member PATCH]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/workspaces/[id]/members/[memberId]
 *
 * Remove a member from the workspace.
 * Requires OWNER or ADMIN role (cannot remove OWNER or self).
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const { userId } = await auth();
    const { id: orgId, memberId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify current user is OWNER or ADMIN
    const currentMember = await db.member.findFirst({
      where: { clerkUserId: userId, orgId },
    });

    if (!currentMember || (currentMember.role !== "OWNER" && currentMember.role !== "ADMIN")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get target member
    const targetMember = await db.member.findFirst({
      where: { id: memberId, orgId },
    });

    if (!targetMember) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Cannot remove OWNER
    if (targetMember.role === "OWNER") {
      return NextResponse.json({ error: "Cannot remove owner" }, { status: 400 });
    }

    // Cannot remove self
    if (targetMember.clerkUserId === userId) {
      return NextResponse.json({ error: "Cannot remove yourself" }, { status: 400 });
    }

    // ADMIN can only remove MEMBER, not other ADMINs
    if (currentMember.role === "ADMIN" && targetMember.role === "ADMIN") {
      return NextResponse.json({ error: "Admins cannot remove other admins" }, { status: 403 });
    }

    await db.member.delete({
      where: { id: memberId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Member DELETE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
