"use client";

import { useRef, useState } from "react";
import { useDriveClient } from "@/lib/drive-client";

type UploadModalProps = {
  open: boolean;
  folderId?: string | null;
  onClose: () => void;
  onComplete: () => void;
};

type UploadItem = {
  name: string;
  progress: number;
  status: "pending" | "uploading" | "done" | "error";
};

export function UploadModal({ open, folderId, onClose, onComplete }: UploadModalProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const client = useDriveClient();
  const [items, setItems] = useState<UploadItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  if (!open) return null;

  const runUpload = async (files: FileList | File[]) => {
    setIsUploading(true);
    const fileArray = Array.from(files);
    setItems(fileArray.map((f) => ({ name: f.name, progress: 0, status: "pending" })));

    await Promise.all(
      fileArray.map(async (file, index) => {
        try {
          setItems((prev) => prev.map((item, i) => (i === index ? { ...item, status: "uploading" } : item)));
          const init = await client.beginUpload({
            name: file.name,
            mimeType: file.type || "application/octet-stream",
            size: file.size,
            folderId,
          });

          await new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("PUT", init.uploadUrl);
            xhr.upload.onprogress = (event) => {
              if (!event.lengthComputable) return;
              const p = Math.round((event.loaded / event.total) * 100);
              setItems((prev) => prev.map((item, i) => (i === index ? { ...item, progress: p } : item)));
            };
            xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("Upload failed")));
            xhr.onerror = () => reject(new Error("Upload failed"));
            xhr.send(file);
          });

          await client.confirmUpload(init.fileId);
          setItems((prev) =>
            prev.map((item, i) => (i === index ? { ...item, progress: 100, status: "done" } : item)),
          );
        } catch {
          setItems((prev) => prev.map((item, i) => (i === index ? { ...item, status: "error" } : item)));
        }
      }),
    );

    setIsUploading(false);
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[rgba(28,28,33,0.9)] p-6 backdrop-blur">
        <h3 className="text-lg font-semibold">Upload files</h3>
        <div
          className="mt-4 rounded-2xl border border-dashed border-white/20 p-8 text-center text-slate-300"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void runUpload(e.dataTransfer.files);
          }}
        >
          Drag & drop files here
          <div className="mt-3">
            <button
              className="rounded-xl bg-[#6961ff] px-4 py-2 text-sm font-medium"
              onClick={() => inputRef.current?.click()}
            >
              Choose files
            </button>
          </div>
        </div>

        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && void runUpload(e.target.files)}
        />

        <div className="mt-4 space-y-2">
          {items.map((item) => (
            <div key={item.name} className="rounded-xl border border-white/10 p-2 text-sm">
              <div className="mb-1 flex justify-between">
                <span className="truncate">{item.name}</span>
                <span className="text-slate-400">{item.status}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-800">
                <div className="h-full rounded-full bg-[#20B2AA]" style={{ width: `${item.progress}%` }} />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button className="rounded-xl border border-white/10 px-3 py-2 text-sm" onClick={onClose} disabled={isUploading}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
