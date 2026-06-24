-- Public Drive assets (logos / branding) live in the public R2 bucket and are
-- NOT envelope-encrypted, so the DEK columns become nullable and an isPublic
-- flag distinguishes them from encrypted vault files.

-- AlterTable
ALTER TABLE "DriveFile" ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "DriveFile" ALTER COLUMN "encryptedDek" DROP NOT NULL;
ALTER TABLE "DriveFile" ALTER COLUMN "dekIv" DROP NOT NULL;
ALTER TABLE "DriveFile" ALTER COLUMN "dekTag" DROP NOT NULL;
ALTER TABLE "DriveFile" ALTER COLUMN "fileIv" DROP NOT NULL;
