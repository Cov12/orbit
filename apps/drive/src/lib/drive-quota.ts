import { Plan } from "@prisma/client";
import { db } from "@/lib/db";

const GB = BigInt(1024 ** 3);

function planQuota(plan: Plan | null | undefined): bigint {
  switch (plan) {
    case Plan.STARTER:
      return BigInt(5) * GB;    // 5 GB
    case Plan.PRO:
      return BigInt(10) * GB;   // 10 GB
    case Plan.BUSINESS:
      return BigInt(50) * GB;   // 50 GB
    case Plan.GROWTH:
      return BigInt(50) * GB;   // 50 GB
    case Plan.ENTERPRISE:
      return BigInt(1024) * GB; // 1 TB
    case Plan.FREE:
    default:
      return GB;                // 1 GB
  }
}

export async function getOrCreateQuota(orgId: string) {
  const existing = await db.storageQuota.findUnique({ where: { orgId } });
  if (existing) return existing;

  // Find the highest-tier subscription for this org (Drive storage scales with any product)
  const subscriptions = await db.subscription.findMany({
    where: { orgId, status: "ACTIVE" },
    orderBy: { plan: "desc" },
  });
  const subscription = subscriptions[0] || null;
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
