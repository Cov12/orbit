-- Add nullable sub-account scoping to Drive-owned tables (NULL = business scope).
-- The SubAccount table itself is owned by Portal's migration in this shared DB.

-- AlterTable
ALTER TABLE "DriveFolder" ADD COLUMN "subAccountId" TEXT;
ALTER TABLE "DriveFile" ADD COLUMN "subAccountId" TEXT;
ALTER TABLE "DriveShare" ADD COLUMN "subAccountId" TEXT;
ALTER TABLE "DriveAuditLog" ADD COLUMN "subAccountId" TEXT;

-- CreateIndex
CREATE INDEX "DriveFolder_orgId_subAccountId_idx" ON "DriveFolder"("orgId", "subAccountId");
CREATE INDEX "DriveFile_orgId_subAccountId_idx" ON "DriveFile"("orgId", "subAccountId");
CREATE INDEX "DriveShare_orgId_subAccountId_idx" ON "DriveShare"("orgId", "subAccountId");
CREATE INDEX "DriveAuditLog_orgId_subAccountId_idx" ON "DriveAuditLog"("orgId", "subAccountId");
