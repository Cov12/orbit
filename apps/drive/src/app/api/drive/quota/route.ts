import { NextResponse } from "next/server";
import { DriveAuditAction } from "@prisma/client";
import { getDriveContext } from "@/lib/drive-auth";
import { logDriveAudit } from "@/lib/drive-audit";
import { driveErrorResponse, serializeBigInts } from "@/lib/drive-http";
import { getOrCreateQuota } from "@/lib/drive-quota";

export async function GET(req: Request) {
  try {
    const { userId, orgId } = await getDriveContext();
    const quota = await getOrCreateQuota(orgId);

    await logDriveAudit({
      orgId,
      userId,
      action: DriveAuditAction.QUOTA_VIEW,
      metadata: {
        usedBytes: quota.usedBytes.toString(),
        quotaBytes: quota.quotaBytes.toString(),
      },
      request: req,
    });

    return NextResponse.json({ quota: serializeBigInts(quota) });
  } catch (error) {
    return driveErrorResponse(error);
  }
}
