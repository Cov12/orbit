"use client";

import { useEffect, useMemo, useState } from "react";
import { formatBytes, type StorageQuota, useDriveClient } from "@/lib/drive-client";

export function QuotaBar() {
  const client = useDriveClient();
  const [quota, setQuota] = useState<StorageQuota | null>(null);

  useEffect(() => {
    client.getQuota().then((res) => setQuota(res.quota)).catch(() => setQuota(null));
  }, [client]);

  const { percent, color } = useMemo(() => {
    if (!quota) return { percent: 0, color: "bg-emerald-500" };
    const used = Number(quota.usedBytes);
    const total = Number(quota.quotaBytes);
    const p = total > 0 ? Math.min((used / total) * 100, 100) : 0;
    return {
      percent: p,
      color: p > 90 ? "bg-red-500" : p >= 70 ? "bg-yellow-500" : "bg-emerald-500",
    };
  }, [quota]);

  if (!quota) {
    return <div className="h-10 w-56 animate-pulse rounded-xl border border-white/10 bg-white/5" />;
  }

  return (
    <div className="w-full max-w-xs rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="mb-2 flex items-center justify-between text-xs text-slate-300">
        <span>Storage</span>
        <span>
          {formatBytes(quota.usedBytes)} / {formatBytes(quota.quotaBytes)}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-800">
        <div className={`h-full ${color} transition-all`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
