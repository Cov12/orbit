"use client";

import { useEffect, useState } from "react";
import { driveClient, formatFileSize } from "@/lib/drive-client";

export default function QuotaBar() {
  const [quota, setQuota] = useState<{ used: number; total: number; files: number } | null>(null);

  useEffect(() => {
    driveClient.getQuota().then(({ quota: q }) => {
      setQuota({
        used: parseInt(q.usedBytes, 10),
        total: parseInt(q.quotaBytes, 10),
        files: q.fileCount,
      });
    }).catch(() => {});
  }, []);

  if (!quota) {
    return <div className="h-2 w-full rounded-full bg-white/5 animate-pulse" />;
  }

  const pct = quota.total > 0 ? (quota.used / quota.total) * 100 : 0;
  const color = pct > 90 ? "#ef4444" : pct > 70 ? "#eab308" : "#20B2AA";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>{formatFileSize(quota.used)} of {formatFileSize(quota.total)}</span>
        <span>{quota.files} files</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
