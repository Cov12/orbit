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
  const url = new URL(req.url);
  const shareToken = url.searchParams.get("token");

  // Public download via share token — no auth required
  if (shareToken) {
    return handlePublicDownload(req, context, shareToken);
  }

  // Authenticated download — requires authenticated session
  return handleAuthDownload(req, context);
}

async function handlePublicDownload(req: Request, context: RouteContext, token: string) {
  try {
    const { fileId } = await context.params;

    // Look up the share link
    const share = await db.driveShare.findUnique({
      where: { token },
    });

    if (!share || share.fileId !== fileId) {
      return NextResponse.json({ error: "Invalid or expired share link" }, { status: 404 });
    }

    // Check revoked
    if (share.isRevoked) {
      return NextResponse.json({ error: "This share link has been revoked" }, { status: 403 });
    }

    // Check expiry
    if (share.expiresAt && share.expiresAt < new Date()) {
      return NextResponse.json({ error: "This share link has expired" }, { status: 410 });
    }

    // Check max accesses
    if (share.maxAccesses !== null && share.accessCount >= share.maxAccesses) {
      return NextResponse.json({ error: "This share link has reached its download limit" }, { status: 410 });
    }

    // Get the file
    const file = await db.driveFile.findFirst({
      where: {
        id: fileId,
        deletedAt: null,
        status: { not: DriveFileStatus.DELETED },
      },
      select: {
        id: true,
        r2Key: true,
        name: true,
        orgId: true,
      },
    });

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Increment access count
    await db.driveShare.update({
      where: { id: share.id },
      data: { accessCount: { increment: 1 } },
    });

    const downloadUrl = await getDownloadSignedUrl(file.r2Key);

    // Audit log (no userId for public downloads)
    await logDriveAudit({
      orgId: file.orgId,
      userId: null,
      fileId,
      action: DriveAuditAction.FILE_DOWNLOAD,
      metadata: { fileName: file.name, shareId: share.id, public: true },
      request: req,
    });

    return NextResponse.json({
      fileId: file.id,
      fileName: file.name,
      downloadUrl,
      expiresIn: 900,
    });
  } catch (error) {
    return driveErrorResponse(error);
  }
}

async function handleAuthDownload(req: Request, context: RouteContext) {
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
