import { S3Client } from "@aws-sdk/client-s3";

/**
 * Cloudflare R2 client for the public Orbit branding bucket.
 *
 * This bucket is PUBLIC-READ and stores unencrypted branding assets (workspace
 * logos) so they yield stable `<img src>` URLs. It is deliberately separate from
 * Orbit Drive's encrypted vault bucket. In the Drive branding sweep (Orbit-drive#4)
 * these objects become Drive-managed and serving moves behind a Drive domain.
 */
export const R2_BUCKET = process.env.R2_BUCKET || "";

/** Public base URL for reads (R2 r2.dev dev URL or a bound custom domain). No trailing slash. */
export const R2_PUBLIC_BASE_URL = (process.env.R2_PUBLIC_BASE_URL || "").replace(/\/+$/, "");

export const r2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
  },
});

/** True when every value the upload route needs is present. */
export function isR2Configured(): boolean {
  return Boolean(
    R2_BUCKET && R2_PUBLIC_BASE_URL && process.env.R2_ENDPOINT &&
    process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY
  );
}
