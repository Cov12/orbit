import { Plan } from "@prisma/client";
import { db } from "@/lib/db";

const GB = BigInt(1024 ** 3);

function planQuota(plan: Plan | null | undefined): bigint {
  switch (plan) {
    case Plan.STARTER:
      return BigInt(10) * GB;
    case Plan.PRO:
      return BigInt(100) * GB;
    case Plan.ENTERPRISE:
      return BigInt(1024) * GB;
    case Plan.FREE:
    default:
      return GB;
  }
}

export async function getOrCreateQuota(orgId: string) {
  const existing = await db.storageQuota.findUnique({ where: { orgId } });
  if (existing) return existing;

  const subscription = await db.subscription.findUnique({ where: { orgId } });
  const quotaBytes = planQuota(subscription?.plan);

  return db.storageQuota.create({
    data: {
      orgId,
      quotaBytes,
      usedBytes: BigInt(0),
      fileCount: 0,
    },
  });
}
