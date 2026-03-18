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
