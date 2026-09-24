"use client";

import { useState } from "react";
import { driveClient } from "@/lib/drive-client";

type Props = {
  fileId: string;
  fileName: string;
  onClose: () => void;
};

export default function ShareModal({ fileId, fileName, onClose }: Props) {
  const [expiry, setExpiry] = useState<number | undefined>(undefined);
  const [maxAccesses, setMaxAccesses] = useState<number | undefined>(undefined);
  const [shareUrl, setShareUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  async function handleShare() {
    setLoading(true);
    setError("");
    try {
      const { share } = await driveClient.shareFile(fileId, expiry, maxAccesses);
      const url = `${window.location.origin}/api/drive/files/${fileId}/download?token=${share.token}`;
      setShareUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create share link");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="glass rounded-2xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-1">Share File</h3>
        <p className="text-sm text-slate-400 mb-4 truncate">{fileName}</p>

        {!shareUrl ? (
          <>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Link Expiry</label>
                <select
                  value={expiry ?? ""}
                  onChange={(e) => setExpiry(e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#6961ff]"
                >
                  <option value="">Never</option>
                  <option value="24">24 hours</option>
                  <option value="168">7 days</option>
                  <option value="720">30 days</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Max Downloads</label>
                <select
                  value={maxAccesses ?? ""}
                  onChange={(e) => setMaxAccesses(e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#6961ff]"
                >
                  <option value="">Unlimited</option>
                  <option value="1">1 download</option>
                  <option value="5">5 downloads</option>
                  <option value="10">10 downloads</option>
                  <option value="50">50 downloads</option>
                </select>
              </div>
            </div>
            {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
            <div className="flex gap-3 mt-4 justify-end">
              <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-white transition">Cancel</button>
              <button
                onClick={handleShare}
                disabled={loading}
                className="px-5 py-2 rounded-xl text-sm font-semibold bg-[#6961ff] text-white hover:bg-[#5a52e0] disabled:opacity-40 transition"
              >
                {loading ? "Creating..." : "Create Link"}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-3 py-2">
              <input type="text" readOnly value={shareUrl} className="flex-1 bg-transparent text-sm text-slate-300 outline-none truncate" />
              <button onClick={handleCopy} className="text-[#6961ff] hover:text-[#20B2AA] transition">
                <span className="material-symbols-outlined text-lg">{copied ? "check" : "content_copy"}</span>
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-2">{copied ? "Copied!" : "Share this link to give access"}</p>
            <div className="flex justify-end mt-4">
              <button onClick={onClose} className="px-5 py-2 rounded-xl text-sm font-semibold bg-[#6961ff] text-white hover:bg-[#5a52e0] transition">Done</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
