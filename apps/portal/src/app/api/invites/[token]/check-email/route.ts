import { clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/invites/[token]/check-email
 *
 * Check if the invited email already exists in Clerk.
 * Protected by invite token to prevent email enumeration.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    // Find the invite by token
    const invite = await db.invite.findUnique({
      where: { token },
    });

    if (!invite) {
      return NextResponse.json({ error: "Invalid invite" }, { status: 404 });
    }

    // Check if invite is expired
    if (invite.expiresAt < new Date()) {
      return NextResponse.json({ error: "Invite expired" }, { status: 410 });
    }

    // Check if already accepted
    if (invite.acceptedAt) {
      return NextResponse.json({ error: "Invite already accepted" }, { status: 410 });
    }

    // Check if email exists in Clerk
    const clerk = await clerkClient();
    const users = await clerk.users.getUserList({
      emailAddress: [invite.email],
      limit: 1,
    });

    const exists = users.data.length > 0;

    return NextResponse.json({ exists });
  } catch (error) {
    console.error("[Check Email]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
