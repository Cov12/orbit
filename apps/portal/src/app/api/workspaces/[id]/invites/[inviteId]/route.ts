import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * POST /api/workspaces/[id]/invites/[inviteId]
 *
 * Resend an existing invite.
 * Requires OWNER or ADMIN role.
 */
export async function POST(
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
      include: { org: true },
    });

    if (!member || (member.role !== "OWNER" && member.role !== "ADMIN")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Find the invite
    const invite = await db.invite.findFirst({
      where: { id: inviteId, orgId, acceptedAt: null },
    });

    if (!invite) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }

    // Extend expiration by 7 more days
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await db.invite.update({
      where: { id: inviteId },
      data: { expiresAt: newExpiresAt },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://portal.orbit.example";
    const inviteUrl = `${appUrl}/invites/${invite.token}`;

    // Resend via Clerk
    let emailSent = false;
    try {
      const clerk = await clerkClient();
      await clerk.invitations.createInvitation({
        emailAddress: invite.email,
        redirectUrl: inviteUrl,
        publicMetadata: {
          inviteToken: invite.token,
          orgId,
          orgName: member.org.name,
          role: invite.role,
          resent: true,
        },
      });
      emailSent = true;
    } catch (clerkError: unknown) {
      const errorMessage = clerkError instanceof Error ? clerkError.message : "Unknown error";
      console.log("[Clerk Resend]", errorMessage);
    }

    return NextResponse.json({
      success: true,
      inviteUrl,
      emailSent,
      expiresAt: newExpiresAt,
    });
  } catch (error) {
    console.error("[Invite Resend]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

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
