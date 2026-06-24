import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const R2_ENDPOINT = process.env.R2_ENDPOINT || "https://<ACCOUNT_ID>.r2.cloudflarestorage.com";
const R2_BUCKET = process.env.R2_BUCKET || "orbit-drive";
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || "";
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || "";
const R2_REGION = process.env.R2_REGION || "auto";

if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
  console.warn("WARNING: R2 credentials not set via environment variables (R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY)");
}

export const r2BucketName = R2_BUCKET;

export const r2Client = new S3Client({
  region: R2_REGION,
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

export async function getUploadSignedUrl(key: string, contentType: string, expiresIn = 900) {
  const command = new PutObjectCommand({
    Bucket: r2BucketName,
    Key: key,
    ContentType: contentType,
  });

  return getSignedUrl(r2Client, command, { expiresIn });
}

export async function getDownloadSignedUrl(key: string, expiresIn = 900) {
  const command = new GetObjectCommand({
    Bucket: r2BucketName,
    Key: key,
  });

  return getSignedUrl(r2Client, command, { expiresIn });
}

// ---------------------------------------------------------------------------
// Public branding bucket — separate, public-read bucket for unencrypted assets
// (logos / branding). Distinct credentials + bucket from the encrypted vault
// above; objects are served directly from R2_PUBLIC_BASE_URL (no signing).
// ---------------------------------------------------------------------------

export const R2_PUBLIC_BUCKET = process.env.R2_PUBLIC_BUCKET || "";
// Public read base (r2.dev dev URL or a bound custom domain). No trailing slash.
export const R2_PUBLIC_BASE_URL = (process.env.R2_PUBLIC_BASE_URL || "").replace(/\/+$/, "");

// Same Cloudflare account as the vault → reuse R2_ENDPOINT unless overridden.
const R2_PUBLIC_ENDPOINT = process.env.R2_PUBLIC_ENDPOINT || R2_ENDPOINT;

export const r2PublicClient = new S3Client({
  region: R2_REGION,
  endpoint: R2_PUBLIC_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_PUBLIC_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_PUBLIC_SECRET_ACCESS_KEY || "",
  },
});

/** True when the public branding bucket is fully configured. */
export function isPublicBucketConfigured(): boolean {
  return Boolean(
    R2_PUBLIC_BUCKET &&
      R2_PUBLIC_BASE_URL &&
      process.env.R2_PUBLIC_ACCESS_KEY_ID &&
      process.env.R2_PUBLIC_SECRET_ACCESS_KEY
  );
}

/** Upload unencrypted bytes to the public bucket. */
export async function putPublicObject(key: string, body: Buffer, contentType: string) {
  await r2PublicClient.send(
    new PutObjectCommand({
      Bucket: R2_PUBLIC_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );
}

/** Stable public URL for a key in the public bucket. */
export function publicUrlForKey(key: string): string {
  return `${R2_PUBLIC_BASE_URL}/${key}`;
}
