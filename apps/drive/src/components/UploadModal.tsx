"use client";

import { useCallback, useState, useRef } from "react";
import { driveClient } from "@/lib/drive-client";

type UploadItem = {
  file: File;
  progress: number;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
};

type Props = {
  folderId: string | null;
  onUploaded: () => void;
  onClose: () => void;
};

export default function UploadModal({ folderId, onUploaded, onClose }: Props) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((files: FileList | File[]) => {
    const newItems: UploadItem[] = Array.from(files).map((f) => ({
      file: f,
      progress: 0,
      status: "pending" as const,
    }));
    setItems((prev) => [...prev, ...newItems]);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  }, [addFiles]);

  async function uploadAll() {
    for (let i = 0; i < items.length; i++) {
      if (items[i].status !== "pending") continue;

      setItems((prev) => prev.map((item, idx) => idx === i ? { ...item, status: "uploading" } : item));

      try {
        const { uploadUrl } = await driveClient.initUpload(
          items[i].file.name,
          items[i].file.type || "application/octet-stream",
          items[i].file.size,
          folderId
        );

        await driveClient.uploadToR2(uploadUrl, items[i].file, (pct) => {
          setItems((prev) => prev.map((item, idx) => idx === i ? { ...item, progress: pct } : item));
        });

        setItems((prev) => prev.map((item, idx) => idx === i ? { ...item, status: "done", progress: 100 } : item));
      } catch (err) {
        setItems((prev) =>
          prev.map((item, idx) =>
            idx === i ? { ...item, status: "error", error: err instanceof Error ? err.message : "Failed" } : item
          )
        );
      }
    }
    onUploaded();
  }

  const pendingCount = items.filter((i) => i.status === "pending").length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="glass rounded-2xl p-6 w-full max-w-lg mx-4 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Upload Files</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${
            dragging ? "border-[#6961ff] bg-[#6961ff]/10" : "border-white/10 hover:border-white/20"
          }`}
        >
          <span className="material-symbols-outlined text-4xl text-slate-500 mb-2 block">cloud_upload</span>
          <p className="text-sm text-slate-400">Drag & drop files here or <span className="text-[#6961ff] font-medium">browse</span></p>
          <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => e.target.files && addFiles(e.target.files)} />
        </div>

        {/* File list */}
        {items.length > 0 && (
          <div className="mt-4 space-y-2 overflow-y-auto flex-1 min-h-0">
            {items.map((item, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2">
                <span className="material-symbols-outlined text-sm text-slate-400">
                  {item.status === "done" ? "check_circle" : item.status === "error" ? "error" : "draft"}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{item.file.name}</p>
                  {item.status === "uploading" && (
                    <div className="h-1 mt-1 rounded-full bg-white/5 overflow-hidden">
                      <div className="h-full rounded-full bg-[#6961ff] transition-all" style={{ width: `${item.progress}%` }} />
                    </div>
                  )}
                  {item.status === "error" && <p className="text-xs text-red-400">{item.error}</p>}
                </div>
                <span className="text-xs text-slate-500">
                  {item.status === "done" ? "✓" : item.status === "uploading" ? `${item.progress}%` : ""}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 mt-4 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-white transition">
            Cancel
          </button>
          <button
            onClick={uploadAll}
            disabled={pendingCount === 0}
            className="px-5 py-2 rounded-xl text-sm font-semibold bg-[#6961ff] text-white hover:bg-[#5a52e0] disabled:opacity-40 transition"
          >
            Upload {pendingCount > 0 ? `(${pendingCount})` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
