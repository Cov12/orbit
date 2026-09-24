import { NextResponse } from "next/server";
import { DriveAuditAction, DriveFileStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { getServiceDriveContext } from "@/lib/drive-auth";
import { logDriveAudit } from "@/lib/drive-audit";
import { driveErrorResponse, serializeBigInts } from "@/lib/drive-http";

/**
 * GET /api/drive/service/files?subAccountId=&folderId=
 *
 * Sub-account-scoped file list for sibling apps (server-to-server, Bearer). The
 * sub-account is explicit + validated (fail-closed); no Drive Member row needed.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const { userId, orgId, subAccountId } = await getServiceDriveContext(
      req,
      url.searchParams.get("subAccountId"),
    );

    const folderId = url.searchParams.get("folderId");

    const files = await db.driveFile.findMany({
      where: {
        orgId,
        subAccountId,
        deletedAt: null,
        status: { not: DriveFileStatus.DELETED },
        folderId: folderId === null ? undefined : folderId,
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        mimeType: true,
        size: true,
        status: true,
        folderId: true,
        uploadedBy: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await logDriveAudit({
      orgId,
      subAccountId,
      userId,
      action: DriveAuditAction.FILE_LIST,
      metadata: { folderId, service: true },
      request: req,
    });

    return NextResponse.json({ files: serializeBigInts(files) });
  } catch (error) {
    return driveErrorResponse(error);
  }
}
