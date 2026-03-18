import fs from "node:fs";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const CREDENTIALS_PATH =
  "/home/ops-user/.openclaw/credentials/accounts/cloudflare-r2.json";
const R2_ENDPOINT = "https://<ACCOUNT_ID>.r2.cloudflarestorage.com";
const R2_BUCKET = "orbit-drive";

type R2Credentials = {
  s3?: {
    accessKeyId?: string;
    secretAccessKey?: string;
    region?: string;
  };
};

const raw = fs.readFileSync(CREDENTIALS_PATH, "utf8");
const credentialsJson = JSON.parse(raw) as R2Credentials;

const accessKeyId = credentialsJson.s3?.accessKeyId;
const secretAccessKey = credentialsJson.s3?.secretAccessKey;

if (!accessKeyId || !secretAccessKey) {
  throw new Error("Invalid Cloudflare R2 credentials JSON");
}

export const r2BucketName = R2_BUCKET;

export const r2Client = new S3Client({
  region: credentialsJson.s3?.region ?? "auto",
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId,
    secretAccessKey,
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
