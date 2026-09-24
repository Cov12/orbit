import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { DriveAuditAction, DriveFileStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getServiceDriveContext } from "@/lib/drive-auth";
import { logDriveAudit } from "@/lib/drive-audit";
import { driveErrorResponse } from "@/lib/drive-http";
import { getOrCreateQuota } from "@/lib/drive-quota";
import { encryptDekForOrg, generateFileKey } from "@/lib/encryption";
import { getUploadSignedUrl } from "@/lib/r2";

type Body = {
  subAccountId?: string | null;
  name?: string;
  mimeType?: string;
  size?: number;
  folderId?: string | null;
};

/**
 * POST /api/drive/service/upload  { subAccountId, name, mimeType, size, folderId? }
 *
 * Service (sibling) counterpart of /api/drive/upload: initializes a
 * sub-account-scoped upload and returns a presigned R2 PUT url. Same encryption
 * + quota bookkeeping as the interactive route; sub-account is explicit +
 * validated (fail-closed). Confirm the upload via POST /service/files/[id].
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const { userId, orgId, subAccountId } = await getServiceDriveContext(
      req,
      body.subAccountId,
    );

    if (
      !body.name ||
      !body.mimeType ||
      !Number.isFinite(body.size) ||
      body.size! <= 0
    ) {
      return NextResponse.json(
        { error: "name, mimeType, and positive size are required" },
        { status: 400 },
      );
    }

    const name = body.name;
    const mimeType = body.mimeType;
    const size = BigInt(Math.trunc(body.size!));

    if (body.folderId) {
      const folder = await db.driveFolder.findFirst({
        where: { id: body.folderId, orgId, subAccountId },
      });
      if (!folder) {
        return NextResponse.json({ error: "Folder not found" }, { status: 404 });
      }
    }

    const quota = await getOrCreateQuota(orgId);
    if (quota.usedBytes + size > quota.quotaBytes) {
      return NextResponse.json(
        { error: "Storage quota exceeded" },
        { status: 413 },
      );
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
          subAccountId,
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
      subAccountId,
      userId,
      fileId: file.id,
      action: DriveAuditAction.FILE_UPLOAD,
      metadata: {
        name: file.name,
        mimeType: file.mimeType,
        size: file.size.toString(),
        status: file.status,
        service: true,
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
