import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/workspaces/[id]/members
 *
 * List all members of a workspace.
 * Any member can view the list.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    const { id: orgId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user is a member of this org
    const currentMember = await db.member.findFirst({
      where: { clerkUserId: userId, orgId },
    });

    if (!currentMember) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get all members
    const members = await db.member.findMany({
      where: { orgId },
      orderBy: [
        { role: "asc" }, // OWNER first, then ADMIN, then MEMBER
        { createdAt: "asc" },
      ],
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      members,
      currentUserId: userId,
      currentMemberRole: currentMember.role,
    });
  } catch (error) {
    console.error("[Members GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
