import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * POST /api/invites/accept
 *
 * Accept an invite and join the workspace.
 * Requires authentication.
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { token } = await req.json();

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    // Find the invite
    const invite = await db.invite.findUnique({
      where: { token },
      include: { org: true },
    });

    if (!invite) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }

    if (invite.acceptedAt) {
      return NextResponse.json({ error: "Invite already accepted" }, { status: 400 });
    }

    if (invite.expiresAt < new Date()) {
      return NextResponse.json({ error: "Invite has expired" }, { status: 400 });
    }

    // Check if user is already a member
    const existingMember = await db.member.findFirst({
      where: { clerkUserId: userId, orgId: invite.orgId },
    });

    if (existingMember) {
      // Mark invite as accepted anyway
      await db.invite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      });

      return NextResponse.json({
        success: true,
        message: "Already a member",
        orgId: invite.orgId,
        orgSlug: invite.org.slug,
      });
    }

    // Get user details from Clerk
    const clerkUser = await currentUser();
    const email = clerkUser?.emailAddresses.find(
      (e) => e.id === clerkUser.primaryEmailAddressId
    )?.emailAddress;
    const name = [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(" ") || null;

    // Create membership and mark invite as accepted
    await db.$transaction([
      db.member.create({
        data: {
          clerkUserId: userId,
          orgId: invite.orgId,
          email,
          name,
          role: invite.role,
        },
      }),
      db.invite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      }),
    ]);

    return NextResponse.json({
      success: true,
      orgId: invite.orgId,
      orgSlug: invite.org.slug,
      orgName: invite.org.name,
      role: invite.role,
    });
  } catch (error) {
    console.error("[Accept Invite]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
