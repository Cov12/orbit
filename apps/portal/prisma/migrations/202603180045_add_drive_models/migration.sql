-- CreateEnum
CREATE TYPE "DriveFileStatus" AS ENUM ('UPLOADING', 'ACTIVE', 'DELETED');

-- CreateEnum
CREATE TYPE "DriveAuditAction" AS ENUM ('FILE_UPLOAD', 'FILE_LIST', 'FILE_METADATA', 'FILE_DOWNLOAD', 'FILE_DELETE', 'FOLDER_CREATE', 'FILE_SHARE', 'QUOTA_VIEW');

-- CreateTable
CREATE TABLE "DriveFolder" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "orgId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriveFolder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriveFile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" BIGINT NOT NULL,
    "r2Key" TEXT NOT NULL,
    "encryptedDek" TEXT NOT NULL,
    "dekIv" TEXT NOT NULL,
    "dekTag" TEXT NOT NULL,
    "fileIv" TEXT NOT NULL,
    "checksum" TEXT,
    "folderId" TEXT,
    "orgId" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "status" "DriveFileStatus" NOT NULL DEFAULT 'UPLOADING',
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriveFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriveShare" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "maxAccesses" INTEGER,
    "accessCount" INTEGER NOT NULL DEFAULT 0,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DriveShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriveAuditLog" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT,
    "fileId" TEXT,
    "action" "DriveAuditAction" NOT NULL,
    "metadata" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DriveAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StorageQuota" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "quotaBytes" BIGINT NOT NULL,
    "usedBytes" BIGINT NOT NULL DEFAULT 0,
    "fileCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StorageQuota_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DriveFolder_orgId_idx" ON "DriveFolder"("orgId");

-- CreateIndex
CREATE INDEX "DriveFolder_parentId_idx" ON "DriveFolder"("parentId");

-- CreateIndex
CREATE INDEX "DriveFolder_orgId_parentId_idx" ON "DriveFolder"("orgId", "parentId");

-- CreateIndex
CREATE UNIQUE INDEX "DriveFile_r2Key_key" ON "DriveFile"("r2Key");

-- CreateIndex
CREATE INDEX "DriveFile_orgId_idx" ON "DriveFile"("orgId");

-- CreateIndex
CREATE INDEX "DriveFile_folderId_idx" ON "DriveFile"("folderId");

-- CreateIndex
CREATE INDEX "DriveFile_orgId_folderId_idx" ON "DriveFile"("orgId", "folderId");

-- CreateIndex
CREATE INDEX "DriveFile_orgId_status_idx" ON "DriveFile"("orgId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "DriveShare_token_key" ON "DriveShare"("token");

-- CreateIndex
CREATE INDEX "DriveShare_token_idx" ON "DriveShare"("token");

-- CreateIndex
CREATE INDEX "DriveShare_fileId_idx" ON "DriveShare"("fileId");

-- CreateIndex
CREATE INDEX "DriveShare_orgId_idx" ON "DriveShare"("orgId");

-- CreateIndex
CREATE INDEX "DriveAuditLog_orgId_idx" ON "DriveAuditLog"("orgId");

-- CreateIndex
CREATE INDEX "DriveAuditLog_fileId_idx" ON "DriveAuditLog"("fileId");

-- CreateIndex
CREATE INDEX "DriveAuditLog_userId_idx" ON "DriveAuditLog"("userId");

-- CreateIndex
CREATE INDEX "DriveAuditLog_action_idx" ON "DriveAuditLog"("action");

-- CreateIndex
CREATE INDEX "DriveAuditLog_orgId_createdAt_idx" ON "DriveAuditLog"("orgId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StorageQuota_orgId_key" ON "StorageQuota"("orgId");

-- CreateIndex
CREATE INDEX "StorageQuota_orgId_idx" ON "StorageQuota"("orgId");

-- AddForeignKey
ALTER TABLE "DriveFolder" ADD CONSTRAINT "DriveFolder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "DriveFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriveFile" ADD CONSTRAINT "DriveFile_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "DriveFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriveShare" ADD CONSTRAINT "DriveShare_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "DriveFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriveAuditLog" ADD CONSTRAINT "DriveAuditLog_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "DriveFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

