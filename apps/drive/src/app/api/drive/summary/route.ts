import { NextResponse } from "next/server";
import { DriveAuditAction, DriveFileStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { getDriveContext } from "@/lib/drive-auth";
import { logDriveAudit } from "@/lib/drive-audit";
import { driveErrorResponse, serializeBigInts } from "@/lib/drive-http";
import { getOrCreateQuota } from "@/lib/drive-quota";

/**
 * Read-only, org/sub-account scoped summary for the cross-ecosystem dashboard.
 *
 * Scope mirrors the file-list route (orgId + subAccountId + non-deleted), so the
 * counts and recent files match exactly what a user sees in their file list.
 */
export async function GET(req: Request) {
  try {
    const { userId, orgId, subAccountId } = await getDriveContext(req);

    // Same visible-file scope the /files route uses (minus the per-folder
    // narrowing), so fileCount/recentFiles reflect the whole scope a user sees.
    const fileWhere = {
      orgId,
      subAccountId,
      deletedAt: null,
      status: { not: DriveFileStatus.DELETED },
    };

    const [quota, fileCount, folderCount, recentFiles] = await Promise.all([
      getOrCreateQuota(orgId),
      db.driveFile.count({ where: fileWhere }),
      db.driveFolder.count({ where: { orgId, subAccountId } }),
      db.driveFile.findMany({
        where: fileWhere,
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          name: true,
          size: true,
          mimeType: true,
          createdAt: true,
        },
      }),
    ]);

    await logDriveAudit({
      orgId,
      subAccountId,
      userId,
      action: DriveAuditAction.QUOTA_VIEW,
      metadata: { summary: true, fileCount, folderCount },
      request: req,
    });

    return NextResponse.json({
      quota: serializeBigInts(quota),
      fileCount,
      folderCount,
      recentFiles: serializeBigInts(recentFiles),
    });
  } catch (error) {
    return driveErrorResponse(error);
  }
}
