import { NextResponse } from "next/server";
import { DriveAuditAction, DriveFileStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { getDriveContext } from "@/lib/drive-auth";
import { logDriveAudit } from "@/lib/drive-audit";
import { driveErrorResponse, serializeBigInts } from "@/lib/drive-http";

export async function GET(req: Request) {
  try {
    const { userId, orgId } = await getDriveContext();

    const url = new URL(req.url);
    const folderId = url.searchParams.get("folderId");

    const files = await db.driveFile.findMany({
      where: {
        orgId,
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
      userId,
      action: DriveAuditAction.FILE_LIST,
      metadata: { folderId },
      request: req,
    });

    return NextResponse.json({ files: serializeBigInts(files) });
  } catch (error) {
    return driveErrorResponse(error);
  }
}
