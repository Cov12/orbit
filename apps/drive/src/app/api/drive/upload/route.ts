import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { DriveAuditAction, DriveFileStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getDriveContext } from "@/lib/drive-auth";
import { logDriveAudit } from "@/lib/drive-audit";
import { driveErrorResponse } from "@/lib/drive-http";
import { getOrCreateQuota } from "@/lib/drive-quota";
import { encryptDekForOrg, generateFileKey } from "@/lib/encryption";
import { getUploadSignedUrl } from "@/lib/r2";

type UploadRequestBody = {
  name?: string;
  mimeType?: string;
  size?: number;
  folderId?: string | null;
};

export async function POST(req: Request) {
  try {
    const { userId, orgId } = await getDriveContext();
    const body = (await req.json()) as UploadRequestBody;

    if (!body.name || !body.mimeType || !Number.isFinite(body.size) || body.size! <= 0) {
      return NextResponse.json({ error: "name, mimeType, and positive size are required" }, { status: 400 });
    }

    const name = body.name;
    const mimeType = body.mimeType;
    const size = BigInt(Math.trunc(body.size!));

    if (body.folderId) {
      const folder = await db.driveFolder.findFirst({
        where: { id: body.folderId, orgId },
      });
      if (!folder) {
        return NextResponse.json({ error: "Folder not found" }, { status: 404 });
      }
    }

    const quota = await getOrCreateQuota(orgId);
    if (quota.usedBytes + size > quota.quotaBytes) {
      return NextResponse.json({ error: "Storage quota exceeded" }, { status: 413 });
    }

    const fileId = crypto.randomUUID();
    const r2Key = `${orgId}/files/${fileId}.enc`;
    const dek = generateFileKey();
    const wrappedDek = encryptDekForOrg(orgId, dek);
    const fileIv = crypto.randomBytes(12).toString("base64");

    const file = await db.$transaction(async (tx: Prisma.TransactionClient) => {
      const created = await tx.driveFile.create({
        data: {
          id: fileId,
          name,
          mimeType,
          size,
          r2Key,
          encryptedDek: wrappedDek.encryptedDek,
          dekIv: wrappedDek.dekIv,
          dekTag: wrappedDek.dekTag,
          fileIv,
          checksum: null,
          folderId: body.folderId ?? null,
          orgId,
          uploadedBy: userId,
          status: DriveFileStatus.UPLOADING,
        },
      });

      await tx.storageQuota.update({
        where: { orgId },
        data: {
          usedBytes: { increment: size },
          fileCount: { increment: 1 },
        },
      });

      return created;
    });

    await logDriveAudit({
      orgId,
      userId,
      fileId: file.id,
      action: DriveAuditAction.FILE_UPLOAD,
      metadata: {
        name: file.name,
        mimeType: file.mimeType,
        size: file.size.toString(),
        status: file.status,
      },
      request: req,
    });

    const uploadUrl = await getUploadSignedUrl(r2Key, mimeType);

    return NextResponse.json({
      fileId: file.id,
      r2Key,
      uploadUrl,
      expiresIn: 900,
    });
  } catch (error) {
    return driveErrorResponse(error);
  }
}
