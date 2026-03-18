import { NextResponse } from "next/server";
import { DriveAuditAction, DriveFileStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getDriveContext } from "@/lib/drive-auth";
import { logDriveAudit } from "@/lib/drive-audit";
import { driveErrorResponse, serializeBigInts } from "@/lib/drive-http";

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
      },
      select: {
        id: true,
        name: true,
        mimeType: true,
        size: true,
        status: true,
        folderId: true,
        checksum: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
      },
    });

    if (!file || file.status === DriveFileStatus.DELETED || file.deletedAt) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    await logDriveAudit({
      orgId,
      userId,
      fileId,
      action: DriveAuditAction.FILE_METADATA,
      request: req,
    });

    return NextResponse.json({ file: serializeBigInts(file) });
  } catch (error) {
    return driveErrorResponse(error);
  }
}

export async function DELETE(req: Request, context: RouteContext) {
  try {
    const { userId, orgId } = await getDriveContext();
    const { fileId } = await context.params;

    const existing = await db.driveFile.findFirst({
      where: {
        id: fileId,
        orgId,
        deletedAt: null,
        status: { not: DriveFileStatus.DELETED },
      },
      select: {
        id: true,
        size: true,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    await db.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.driveFile.update({
        where: { id: fileId },
        data: {
          status: DriveFileStatus.DELETED,
          deletedAt: new Date(),
        },
      });

      await tx.storageQuota.update({
        where: { orgId },
        data: {
          usedBytes: { decrement: existing.size },
          fileCount: { decrement: 1 },
        },
      });
    });

    await logDriveAudit({
      orgId,
      userId,
      fileId,
      action: DriveAuditAction.FILE_DELETE,
      request: req,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return driveErrorResponse(error);
  }
}
