import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { DriveAuditAction, DriveFileStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { getDriveContext } from "@/lib/drive-auth";
import { logDriveAudit } from "@/lib/drive-audit";
import { driveErrorResponse } from "@/lib/drive-http";

type RouteContext = {
  params: Promise<{ fileId: string }>;
};

type ShareBody = {
  expiresInHours?: number;
  maxAccesses?: number;
};

export async function POST(req: Request, context: RouteContext) {
  try {
    const { userId, orgId } = await getDriveContext();
    const { fileId } = await context.params;
    const body = (await req.json().catch(() => ({}))) as ShareBody;

    const file = await db.driveFile.findFirst({
      where: {
        id: fileId,
        orgId,
        deletedAt: null,
        status: { not: DriveFileStatus.DELETED },
      },
      select: { id: true },
    });

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const token = crypto.randomBytes(32).toString("base64url");
    const expiresAt =
      typeof body.expiresInHours === "number" && body.expiresInHours > 0
        ? new Date(Date.now() + body.expiresInHours * 60 * 60 * 1000)
        : null;

    const share = await db.driveShare.create({
      data: {
        token,
        fileId,
        orgId,
        createdBy: userId,
        expiresAt,
        maxAccesses: typeof body.maxAccesses === "number" ? body.maxAccesses : null,
      },
    });

    await logDriveAudit({
      orgId,
      userId,
      fileId,
      action: DriveAuditAction.FILE_SHARE,
      metadata: {
        shareId: share.id,
        expiresAt: share.expiresAt?.toISOString() ?? null,
        maxAccesses: share.maxAccesses,
      },
      request: req,
    });

    return NextResponse.json({
      shareId: share.id,
      token: share.token,
      expiresAt: share.expiresAt,
      maxAccesses: share.maxAccesses,
    });
  } catch (error) {
    return driveErrorResponse(error);
  }
}
