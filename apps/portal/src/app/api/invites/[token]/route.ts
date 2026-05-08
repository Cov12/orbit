import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/invites/[token]
 *
 * Get invite details by token (public endpoint for invite page).
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const invite = await db.invite.findUnique({
      where: { token },
      include: {
        org: {
          select: { name: true },
        },
      },
    });

    if (!invite) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }

    return NextResponse.json({
      orgName: invite.org.name,
      role: invite.role,
      email: invite.email,
      expired: invite.expiresAt < new Date(),
      alreadyAccepted: !!invite.acceptedAt,
    });
  } catch (error) {
    console.error("[Get Invite]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
