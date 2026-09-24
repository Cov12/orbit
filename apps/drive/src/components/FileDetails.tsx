"use client";

import { DriveFile, formatFileSize, getFileIcon, timeAgo } from "@/lib/drive-client";

type Props = {
  file: DriveFile;
  onClose: () => void;
  onDownload: (fileId: string) => void;
  onShare: (fileId: string) => void;
  onDelete: (fileId: string) => void;
};

export default function FileDetails({ file, onClose, onDownload, onShare, onDelete }: Props) {
  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full max-w-sm glass border-l border-white/5 p-6 flex flex-col animate-slide-in">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold">File Details</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-white transition">
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>

      {/* Icon */}
      <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-[#6961ff]/10 mb-4">
        <span className="material-symbols-outlined text-3xl text-[#6961ff]">{getFileIcon(file.mimeType)}</span>
      </div>

      {/* Info */}
      <h4 className="font-medium text-white mb-4 break-all">{file.name}</h4>

      <div className="space-y-3 text-sm flex-1">
        <div className="flex justify-between">
          <span className="text-slate-400">Size</span>
          <span>{formatFileSize(file.size)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Type</span>
          <span className="truncate ml-4">{file.mimeType}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Uploaded</span>
          <span>{timeAgo(file.createdAt)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Status</span>
          <span className={file.status === "ACTIVE" ? "text-[#20B2AA]" : "text-slate-500"}>{file.status}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-2 mt-6">
        <button
          onClick={() => onDownload(file.id)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#6961ff] text-white text-sm font-semibold hover:bg-[#5a52e0] transition"
        >
          <span className="material-symbols-outlined text-lg">download</span> Download
        </button>
        <button
          onClick={() => onShare(file.id)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm font-medium hover:bg-white/10 transition"
        >
          <span className="material-symbols-outlined text-lg">share</span> Share
        </button>
        <button
          onClick={() => onDelete(file.id)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-red-400 text-sm font-medium hover:bg-red-500/10 transition"
        >
          <span className="material-symbols-outlined text-lg">delete</span> Delete
        </button>
      </div>
    </div>
  );
}
