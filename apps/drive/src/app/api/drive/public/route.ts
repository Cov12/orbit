import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { DriveAuditAction, DriveFileStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getDriveContext } from "@/lib/drive-auth";
import { logDriveAudit } from "@/lib/drive-audit";
import { driveErrorResponse } from "@/lib/drive-http";
import { getOrCreateQuota } from "@/lib/drive-quota";
import {
  putPublicObject,
  publicUrlForKey,
  isPublicBucketConfigured,
} from "@/lib/r2";

export const runtime = "nodejs";

const MAX_BYTES = 4 * 1024 * 1024; // 4MB
const EXT_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/gif": "gif",
};

/**
 * POST /api/drive/public  (multipart form field: `file`)
 *
 * Uploads an UNENCRYPTED branding asset (logo) to the public bucket and records
 * it as a managed, public DriveFile (so it shows in the Drive UI and can be
 * renamed/deleted like any file). Returns the stable public URL — served
 * directly from R2, no signing/expiry, suitable for <img src>.
 *
 * Org/sub-account scoped via the Orbit JWT (getDriveContext). Distinct from the
 * encrypted vault upload (/api/drive/upload): public assets have no DEK.
 *
 * Returns: { fileId, url }
 */
export async function POST(req: Request) {
  try {
    const { userId, orgId, subAccountId } = await getDriveContext(req);

    if (!isPublicBucketConfigured()) {
      return NextResponse.json(
        { error: "Public asset storage is not configured" },
        { status: 500 }
      );
    }

    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const ext = EXT_BY_TYPE[file.type];
    if (!ext) {
      return NextResponse.json(
        { error: "Unsupported image type (use PNG, JPEG, WebP, SVG, or GIF)" },
        { status: 415 }
      );
    }
    if (file.size <= 0 || file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Image must be between 0 and 4MB" }, { status: 413 });
    }

    const fileId = crypto.randomUUID();
    const scope = subAccountId ? `${orgId}/${subAccountId}` : orgId;
    const r2Key = `public/${scope}/${fileId}.${ext}`;
    const size = BigInt(file.size);
    const bytes = Buffer.from(await file.arrayBuffer());

    // Upload unencrypted to the public bucket first.
    await putPublicObject(r2Key, bytes, file.type);

    // Record as a managed public file. Branding always uploads (no quota gate),
    // but still counts toward usage so the delete path's decrement stays correct.
    await getOrCreateQuota(orgId);
    const created = await db.$transaction(async (tx: Prisma.TransactionClient) => {
      const f = await tx.driveFile.create({
        data: {
          id: fileId,
          name: file.name || `logo.${ext}`,
          mimeType: file.type,
          size,
          r2Key,
          isPublic: true,
          orgId,
          subAccountId,
          uploadedBy: userId,
          status: DriveFileStatus.ACTIVE,
        },
      });
      await tx.storageQuota.update({
        where: { orgId },
        data: { usedBytes: { increment: size }, fileCount: { increment: 1 } },
      });
      return f;
    });

    await logDriveAudit({
      orgId,
      subAccountId,
      userId,
      fileId: created.id,
      action: DriveAuditAction.FILE_UPLOAD,
      metadata: {
        name: created.name,
        mimeType: created.mimeType,
        size: created.size.toString(),
        public: true,
      },
      request: req,
    });

    return NextResponse.json({ fileId: created.id, url: publicUrlForKey(r2Key) });
  } catch (error) {
    return driveErrorResponse(error);
  }
}
