"use client";

import { useState } from "react";
import { formatBytes, type DriveFile, useDriveClient } from "@/lib/drive-client";
import { ShareModal } from "@/components/ShareModal";

export function FileDetails({
  file,
  open,
  onClose,
  onDeleted,
}: {
  file: DriveFile | null;
  open: boolean;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const client = useDriveClient();
  const [shareOpen, setShareOpen] = useState(false);

  if (!open || !file) return null;

  const download = async () => {
    const data = await client.getDownloadUrl(file.id);
    window.open(data.downloadUrl, "_blank");
  };

  const remove = async () => {
    await client.deleteFile(file.id);
    onDeleted();
    onClose();
  };

  return (
    <>
      <aside className="fixed right-0 top-0 z-40 h-full w-full max-w-md border-l border-white/10 bg-[rgba(28,28,33,0.95)] p-6 backdrop-blur">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-lg font-semibold">File details</h3>
          <button onClick={onClose} className="text-slate-400">
            ✕
          </button>
        </div>
        <dl className="space-y-4 text-sm">
          <div><dt className="text-slate-400">Name</dt><dd>{file.name}</dd></div>
          <div><dt className="text-slate-400">Size</dt><dd>{formatBytes(file.size)}</dd></div>
          <div><dt className="text-slate-400">Type</dt><dd>{file.mimeType}</dd></div>
          <div><dt className="text-slate-400">Uploaded by</dt><dd>{file.uploadedBy ?? "Unknown"}</dd></div>
          <div><dt className="text-slate-400">Date</dt><dd>{new Date(file.createdAt).toLocaleString()}</dd></div>
        </dl>

        <div className="mt-8 grid gap-2">
          <button className="rounded-xl bg-[#20B2AA] px-4 py-2 text-sm font-medium" onClick={() => void download()}>
            Download
          </button>
          <button className="rounded-xl border border-white/10 px-4 py-2 text-sm" onClick={() => setShareOpen(true)}>
            Share
          </button>
          <button className="rounded-xl border border-red-500/40 px-4 py-2 text-sm text-red-300" onClick={() => void remove()}>
            Delete
          </button>
        </div>
      </aside>
      <ShareModal fileId={file.id} open={shareOpen} onClose={() => setShareOpen(false)} />
    </>
  );
}
