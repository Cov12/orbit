import { db } from "@/lib/db";
import type { DriveAuditAction } from "@prisma/client";

export async function logDriveAudit(input: {
  orgId: string;
  subAccountId?: string | null;
  userId?: string | null;
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
      subAccountId: input.subAccountId ?? null,
      userId: input.userId,
      fileId: input.fileId,
      action: input.action,
      metadata: input.metadata as any,
      ip,
      userAgent,
    },
  });
}
