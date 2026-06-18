import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import {
  getDriveContext,
  DRIVE_SUBACCOUNT_COOKIE,
  DRIVE_BUSINESS_SCOPE,
} from "@/lib/drive-auth";
import { driveErrorResponse } from "@/lib/drive-http";

/**
 * POST /api/drive/subaccounts/select
 * Body: { subAccountId: string | null }
 *
 * Sets Drive's local sub-account selection cookie. `null` = explicit business
 * scope (the BUSINESS sentinel). A sub-account id must belong to the current org
 * and be ACTIVE, otherwise it is rejected — the cookie can never scope into
 * another org's data.
 */
export async function POST(req: Request) {
  try {
    const { orgId } = await getDriveContext(req);
    const body = await req.json().catch(() => ({}));
    const subAccountId: string | null =
      typeof body.subAccountId === "string" && body.subAccountId.length > 0
        ? body.subAccountId
        : null;

    const cookieStore = await cookies();
    const cookieOpts = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      maxAge: 60 * 60 * 24 * 365, // 1 year
      path: "/",
    };

    if (!subAccountId) {
      cookieStore.set(DRIVE_SUBACCOUNT_COOKIE, DRIVE_BUSINESS_SCOPE, cookieOpts);
      return NextResponse.json({ selected: null });
    }

    const sub = await db.subAccount.findFirst({
      where: { id: subAccountId, orgId, status: "ACTIVE" },
      select: { id: true },
    });
    if (!sub) {
      return NextResponse.json(
        { error: "Sub-account not found in this workspace" },
        { status: 404 },
      );
    }

    cookieStore.set(DRIVE_SUBACCOUNT_COOKIE, subAccountId, cookieOpts);
    return NextResponse.json({ selected: subAccountId });
  } catch (error) {
    return driveErrorResponse(error);
  }
}
