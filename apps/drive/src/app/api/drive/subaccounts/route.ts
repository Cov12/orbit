import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getDriveContext } from "@/lib/drive-auth";
import { driveErrorResponse } from "@/lib/drive-http";

/**
 * GET /api/drive/subaccounts
 *
 * Lists the current org's ACTIVE sub-accounts plus the currently-active
 * selection (resolved from the Drive cookie → Portal JWT claim → business).
 * Used by the in-app sub-account switcher.
 */
export async function GET(req: Request) {
  try {
    const { orgId, subAccountId } = await getDriveContext(req);

    const subAccounts = await db.subAccount.findMany({
      where: { orgId, status: "ACTIVE" },
      select: { id: true, name: true, slug: true },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ subAccounts, activeSubAccountId: subAccountId });
  } catch (error) {
    return driveErrorResponse(error);
  }
}
