import { db } from "@/lib/db";
import type { DriveAuditAction } from "@prisma/client";

export async function logDriveAudit(input: {
  orgId: string;
  userId?: string;
  fileId?: string;
  action: DriveAuditAction;
  metadata?: Record<string, unknown>;
  request?: Request;
}) {
  const ip = input.request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = input.request?.headers.get("user-agent") ?? null;

  await db.driveAuditLog.create({
    data: {
      orgId: input.orgId,
      userId: input.userId,
      fileId: input.fileId,
      action: input.action,
      metadata: input.metadata,
      ip,
      userAgent,
    },
  });
}
