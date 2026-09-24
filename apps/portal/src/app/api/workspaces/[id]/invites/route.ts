import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/workspaces/[id]/invites
 *
 * List all pending invites for a workspace.
 * Requires OWNER or ADMIN role.
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

    // Verify user is OWNER or ADMIN of this org
    const member = await db.member.findFirst({
      where: { clerkUserId: userId, orgId },
    });

    if (!member || (member.role !== "OWNER" && member.role !== "ADMIN")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get pending invites (not accepted, not expired)
    const invites = await db.invite.findMany({
      where: {
        orgId,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        role: true,
        token: true,
        createdAt: true,
        expiresAt: true,
      },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://portal.orbit.example";
    const invitesWithUrl = invites.map((inv) => ({
      ...inv,
      inviteUrl: `${appUrl}/invites/${inv.token}`,
    }));

    return NextResponse.json({ invites: invitesWithUrl });
  } catch (error) {
    console.error("[Invites GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/workspaces/[id]/invites
 *
 * Create a new invite and send email.
 * Requires OWNER or ADMIN role.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    const { id: orgId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { email, role = "MEMBER" } = await req.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Validate role
    if (!["MEMBER", "ADMIN"].includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    // Verify user is OWNER or ADMIN of this org
    const member = await db.member.findFirst({
      where: { clerkUserId: userId, orgId },
      include: { org: true },
    });

    if (!member || (member.role !== "OWNER" && member.role !== "ADMIN")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check if user is already a member
    const existingMember = await db.member.findFirst({
      where: { email: email.toLowerCase(), orgId },
    });

    if (existingMember) {
      return NextResponse.json(
        { error: "User is already a member of this workspace" },
        { status: 400 }
      );
    }

    // Check for existing pending invite
    const existingInvite = await db.invite.findFirst({
      where: {
        email: email.toLowerCase(),
        orgId,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (existingInvite) {
      return NextResponse.json(
        { error: "An invite is already pending for this email" },
        { status: 400 }
      );
    }

    // Create invite (expires in 7 days)
    const invite = await db.invite.create({
      data: {
        email: email.toLowerCase(),
        orgId,
        role,
        invitedBy: userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://portal.orbit.example";
    const inviteUrl = `${appUrl}/invites/${invite.token}`;

    // Send invite via Clerk
    let emailSent = false;
    try {
      const clerk = await clerkClient();
      await clerk.invitations.createInvitation({
        emailAddress: email.toLowerCase(),
        redirectUrl: inviteUrl,
        publicMetadata: {
          inviteToken: invite.token,
          orgId,
          orgName: member.org.name,
          role,
        },
      });
      emailSent = true;
    } catch (clerkError: unknown) {
      // Clerk invitation may fail if user already exists in Clerk
      // That's okay - they can still use the invite link
      const errorMessage = clerkError instanceof Error ? clerkError.message : "Unknown error";
      console.log("[Clerk Invite]", errorMessage);
    }

    return NextResponse.json({
      invite: {
        id: invite.id,
        email: invite.email,
        role: invite.role,
        token: invite.token,
        expiresAt: invite.expiresAt,
        inviteUrl,
        emailSent,
      },
    });
  } catch (error) {
    console.error("[Invites POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
