"use client";

import { useEffect, useState } from "react";
import { formatBytes, type DriveShare, useDriveClient } from "@/lib/drive-client";

export default function SharedPage() {
  const client = useDriveClient();
  const [shares, setShares] = useState<DriveShare[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const res = await client.listShares();
    setShares(res.shares);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return <div className="h-40 animate-pulse rounded-2xl border border-white/10 bg-white/5" />;
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-[rgba(28,28,33,0.7)] p-4 backdrop-blur">
      <h1 className="mb-4 text-xl font-semibold">Shared Files</h1>
      <div className="space-y-3">
        {shares.map((share) => (
          <div key={share.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium">{share.file?.name ?? "Unknown file"}</p>
                <p className="text-xs text-slate-400">{formatBytes(share.file?.size ?? 0)}</p>
                <p className="mt-1 text-xs text-[#20B2AA]">
                  {typeof window !== "undefined" ? `${window.location.origin}/share/${share.token}` : share.token}
                </p>
              </div>
              <button
                className="rounded-lg border border-red-500/30 px-3 py-1 text-xs text-red-300"
                onClick={async () => {
                  await client.revokeShare(share.id);
                  void load();
                }}
              >
                Revoke
              </button>
            </div>
            <div className="mt-2 flex gap-4 text-xs text-slate-400">
              <span>Accesses: {share.accessCount}{share.maxAccesses ? `/${share.maxAccesses}` : ""}</span>
              <span>Expiry: {share.expiresAt ? new Date(share.expiresAt).toLocaleString() : "Never"}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
