import { NextResponse } from "next/server";
import { DriveAuditAction, DriveFileStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { getDriveContext } from "@/lib/drive-auth";
import { logDriveAudit } from "@/lib/drive-audit";
import { driveErrorResponse } from "@/lib/drive-http";
import { getDownloadSignedUrl } from "@/lib/r2";

type RouteContext = {
  params: Promise<{ fileId: string }>;
};

export async function GET(req: Request, context: RouteContext) {
  try {
    const { userId, orgId } = await getDriveContext();
    const { fileId } = await context.params;

    const file = await db.driveFile.findFirst({
      where: {
        id: fileId,
        orgId,
        deletedAt: null,
        status: { not: DriveFileStatus.DELETED },
      },
      select: {
        id: true,
        r2Key: true,
        name: true,
      },
    });

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const downloadUrl = await getDownloadSignedUrl(file.r2Key);

    await logDriveAudit({
      orgId,
      userId,
      fileId,
      action: DriveAuditAction.FILE_DOWNLOAD,
      metadata: { fileName: file.name },
      request: req,
    });

    return NextResponse.json({
      fileId: file.id,
      downloadUrl,
      expiresIn: 900,
    });
  } catch (error) {
    return driveErrorResponse(error);
  }
}
