import { NextResponse } from "next/server";
import { DriveAuditAction, DriveFileStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getServiceDriveContext } from "@/lib/drive-auth";
import { logDriveAudit } from "@/lib/drive-audit";
import { driveErrorResponse, serializeBigInts } from "@/lib/drive-http";

type RouteContext = { params: Promise<{ fileId: string }> };

const FILE_SELECT = {
  id: true,
  name: true,
  mimeType: true,
  size: true,
  status: true,
  folderId: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * POST /api/drive/service/files/:fileId  { subAccountId }
 * Confirm a service upload (UPLOADING → ACTIVE). Sub-account-scoped + validated.
 */
export async function POST(req: Request, context: RouteContext) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      subAccountId?: string | null;
    };
    const { orgId, subAccountId } = await getServiceDriveContext(
      req,
      body.subAccountId,
    );
    const { fileId } = await context.params;

    const file = await db.driveFile.findFirst({
      where: { id: fileId, orgId, subAccountId, deletedAt: null },
      select: FILE_SELECT,
    });
    if (!file || file.status === DriveFileStatus.DELETED) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const updated =
      file.status === DriveFileStatus.ACTIVE
        ? file
        : await db.driveFile.update({
            where: { id: fileId },
            data: { status: DriveFileStatus.ACTIVE },
            select: FILE_SELECT,
          });

    return NextResponse.json({ file: serializeBigInts(updated) });
  } catch (error) {
    return driveErrorResponse(error);
  }
}

/**
 * DELETE /api/drive/service/files/:fileId?subAccountId=
 * Soft-delete a service file + decrement quota. Sub-account-scoped + validated.
 */
export async function DELETE(req: Request, context: RouteContext) {
  try {
    const url = new URL(req.url);
    const { userId, orgId, subAccountId } = await getServiceDriveContext(
      req,
      url.searchParams.get("subAccountId"),
    );
    const { fileId } = await context.params;

    const existing = await db.driveFile.findFirst({
      where: {
        id: fileId,
        orgId,
        subAccountId,
        deletedAt: null,
        status: { not: DriveFileStatus.DELETED },
      },
      select: { id: true, size: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    await db.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.driveFile.update({
        where: { id: fileId },
        data: { status: DriveFileStatus.DELETED, deletedAt: new Date() },
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
      subAccountId,
      userId,
      fileId,
      action: DriveAuditAction.FILE_DELETE,
      metadata: { service: true },
      request: req,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return driveErrorResponse(error);
  }
}
