import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

type EnvelopeResult = {
  encryptedDek: string;
  dekIv: string;
  dekTag: string;
};

export type EncryptedFilePayload = {
  ciphertext: Buffer;
  fileIv: string;
  fileTag: string;
  checksum: string;
};

function decodeMasterKey(): Buffer {
  const raw = process.env.DRIVE_MASTER_KEY;

  if (!raw) {
    throw new Error("DRIVE_MASTER_KEY is not configured");
  }

  const trimmed = raw.trim();
  if (/^[a-fA-F0-9]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, "hex");
  }

  const base64 = Buffer.from(trimmed, "base64");
  if (base64.length === 32) {
    return base64;
  }

  throw new Error("DRIVE_MASTER_KEY must be 32 bytes (hex or base64)");
}

function getOrgKey(orgId: string): Buffer {
  return crypto.createHmac("sha256", decodeMasterKey()).update(orgId).digest();
}

export function generateFileKey(): Buffer {
  return crypto.randomBytes(32);
}

export function encryptDekForOrg(orgId: string, dek: Buffer): EnvelopeResult {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getOrgKey(orgId), iv);

  const encrypted = Buffer.concat([cipher.update(dek), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    encryptedDek: encrypted.toString("base64"),
    dekIv: iv.toString("base64"),
    dekTag: tag.toString("base64"),
  };
}

export function decryptDekForOrg(orgId: string, encryptedDek: string, dekIv: string, dekTag: string): Buffer {
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    getOrgKey(orgId),
    Buffer.from(dekIv, "base64")
  );

  decipher.setAuthTag(Buffer.from(dekTag, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedDek, "base64")),
    decipher.final(),
  ]);
}

export function encryptFileBuffer(fileBuffer: Buffer, dek: Buffer): EncryptedFilePayload {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, dek, iv);

  const ciphertext = Buffer.concat([cipher.update(fileBuffer), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    ciphertext,
    fileIv: iv.toString("base64"),
    fileTag: tag.toString("base64"),
    checksum: crypto.createHash("sha256").update(fileBuffer).digest("hex"),
  };
}

export function decryptFileBuffer(ciphertext: Buffer, dek: Buffer, fileIv: string, fileTag: string): Buffer {
  const decipher = crypto.createDecipheriv(ALGORITHM, dek, Buffer.from(fileIv, "base64"));
  decipher.setAuthTag(Buffer.from(fileTag, "base64"));

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}
