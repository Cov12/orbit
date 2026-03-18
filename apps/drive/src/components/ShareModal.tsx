"use client";

import { useMemo, useState } from "react";
import { useDriveClient } from "@/lib/drive-client";

const expiryMap: Record<string, number | undefined> = {
  "24h": 24,
  "7d": 24 * 7,
  "30d": 24 * 30,
  never: undefined,
};

export function ShareModal({ fileId, open, onClose }: { fileId: string; open: boolean; onClose: () => void }) {
  const client = useDriveClient();
  const [expiry, setExpiry] = useState<keyof typeof expiryMap>("7d");
  const [maxAccesses, setMaxAccesses] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const shareUrl = useMemo(() => {
    if (!link) return null;
    return `${window.location.origin}/share/${link}`;
  }, [link]);

  if (!open) return null;

  const create = async () => {
    setLoading(true);
    const res = await client.shareFile(fileId, {
      expiresInHours: expiryMap[expiry],
      maxAccesses: maxAccesses ? Number(maxAccesses) : undefined,
    });
    setLink(res.token);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[rgba(28,28,33,0.9)] p-6 backdrop-blur">
        <h3 className="text-lg font-semibold">Share file</h3>
        <label className="mt-4 block text-sm text-slate-300">Expires</label>
        <select
          className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2"
          value={expiry}
          onChange={(e) => setExpiry(e.target.value as keyof typeof expiryMap)}
        >
          <option value="24h">24 hours</option>
          <option value="7d">7 days</option>
          <option value="30d">30 days</option>
          <option value="never">Never</option>
        </select>

        <label className="mt-4 block text-sm text-slate-300">Max accesses</label>
        <input
          value={maxAccesses}
          onChange={(e) => setMaxAccesses(e.target.value)}
          className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2"
          placeholder="Optional"
        />

        {shareUrl && (
          <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3 text-sm">
            <p className="truncate text-[#20B2AA]">{shareUrl}</p>
            <button
              className="mt-2 rounded-lg border border-white/10 px-2 py-1"
              onClick={() => navigator.clipboard.writeText(shareUrl)}
            >
              Copy link
            </button>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button className="rounded-xl border border-white/10 px-3 py-2" onClick={onClose}>
            Close
          </button>
          <button className="rounded-xl bg-[#6961ff] px-3 py-2" onClick={() => void create()} disabled={loading}>
            Generate Link
          </button>
        </div>
      </div>
    </div>
  );
}
