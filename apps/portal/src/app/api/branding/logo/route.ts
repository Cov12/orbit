import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";

import { r2, R2_BUCKET, R2_PUBLIC_BASE_URL, isR2Configured } from "@/lib/r2";

// Needs Node runtime for the AWS SDK + Buffer.
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
 * POST /api/branding/logo  (multipart form field: `file`)
 *
 * Uploads a workspace logo to the public R2 branding bucket and returns its
 * stable public URL. Clerk-authed but org-agnostic: during onboarding the org
 * does not exist yet (it's created at the end of the wizard), so the returned
 * URL is attached to Organization.logoUrl at create time.
 *
 * Returns: { url: string }
 */
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isR2Configured()) {
    console.error("[Branding] R2 env not configured");
    return NextResponse.json({ error: "Branding storage is not configured" }, { status: 500 });
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

  // No org yet at onboarding time — key by uploader + random id. Drive re-homes
  // and manages these in the branding sweep (Orbit-drive#4).
  const key = `logos/${userId}/${crypto.randomUUID()}.${ext}`;
  const body = Buffer.from(await file.arrayBuffer());

  try {
    await r2.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: body,
        ContentType: file.type,
        CacheControl: "public, max-age=31536000, immutable",
      })
    );
  } catch (err) {
    console.error("[Branding] R2 upload failed:", err);
    return NextResponse.json({ error: "Upload failed, please try again" }, { status: 502 });
  }

  return NextResponse.json({ url: `${R2_PUBLIC_BASE_URL}/${key}` });
}
