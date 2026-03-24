import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

/**
 * GET /api/drive/debug — Temporary diagnostic endpoint
 * Shows auth state and DB lookup results
 * TODO: Remove before production launch
 */
export async function GET() {
  try {
    const authResult = await auth();
    const userId = authResult.userId;
    const orgId = authResult.orgId;

    if (!userId) {
      return NextResponse.json({ step: "auth", error: "No userId from Clerk", authResult: { userId, orgId } });
    }

    // Check member lookup
    let memberships;
    try {
      memberships = await db.member.findMany({
        where: { clerkUserId: userId },
        include: { org: true },
      });
    } catch (dbError: any) {
      return NextResponse.json({ step: "db_member_lookup", error: dbError.message, userId });
    }

    if (memberships.length === 0) {
      return NextResponse.json({ step: "no_memberships", userId, orgId, message: "User has no org memberships in DB" });
    }

    return NextResponse.json({
      step: "ok",
      userId,
      clerkOrgId: orgId,
      memberships: memberships.map((m: any) => ({
        orgId: m.orgId,
        orgName: m.org.name,
        role: m.role,
      })),
    });
  } catch (error: any) {
    return NextResponse.json({ step: "unexpected", error: error.message, stack: error.stack?.split('\n').slice(0, 5) });
  }
}
