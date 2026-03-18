"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { FileDetails } from "@/components/FileDetails";
import { NewFolderModal } from "@/components/NewFolderModal";
import { ShareModal } from "@/components/ShareModal";
import { UploadButton } from "@/components/UploadButton";
import { formatBytes, type DriveFile, type DriveFolder, useDriveClient } from "@/lib/drive-client";

type MenuState = { x: number; y: number; file: DriveFile } | null;

function iconForMime(mime: string) {
  if (mime.startsWith("image/")) return "🖼️";
  if (mime.includes("pdf")) return "📕";
  if (mime.includes("sheet") || mime.includes("excel")) return "📊";
  if (mime.includes("zip")) return "🗜️";
  if (mime.includes("video")) return "🎬";
  return "📄";
}

export default function DrivePage() {
  const client = useDriveClient();
  const search = useSearchParams();
  const router = useRouter();
  const folderId = search.get("folderId");

  const [view, setView] = useState<"grid" | "list">("grid");
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<DriveFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [menu, setMenu] = useState<MenuState>(null);
  const [selected, setSelected] = useState<DriveFile | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

  const refresh = async () => {
    setLoading(true);
    const [fRes, folderRes] = await Promise.all([client.listFiles(folderId), client.listFolders(folderId)]);
    setFiles(fRes.files);
    setFolders(folderRes.folders);
    setBreadcrumbs(folderRes.breadcrumbs);
    setLoading(false);
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folderId]);

  const isEmpty = !loading && files.length === 0 && folders.length === 0;

  const containerClass = useMemo(
    () => (view === "grid" ? "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" : "space-y-2"),
    [view],
  );

  return (
    <div className="space-y-6" onClick={() => setMenu(null)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-slate-300">
          <button onClick={() => router.push("/drive")} className="hover:text-white">
            Root
          </button>
          {breadcrumbs.map((crumb) => (
            <span key={crumb.id}>
              {" / "}
              <button onClick={() => router.push(`/drive?folderId=${crumb.id}`)} className="hover:text-white">
                {crumb.name}
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <button className="rounded-xl border border-white/10 px-3 py-2 text-sm" onClick={() => setView("grid")}>Grid</button>
          <button className="rounded-xl border border-white/10 px-3 py-2 text-sm" onClick={() => setView("list")}>List</button>
          <NewFolderModal parentId={folderId} onCreated={() => void refresh()} />
          <UploadButton folderId={folderId} onUploaded={() => void refresh()} />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
          ))}
        </div>
      ) : isEmpty ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center text-slate-300">
          No files yet — upload your first file
        </div>
      ) : (
        <div className={containerClass}>
          {folders.map((folder) => (
            <button
              key={folder.id}
              onClick={() => router.push(`/drive?folderId=${folder.id}`)}
              className="rounded-2xl border border-white/10 bg-[rgba(28,28,33,0.7)] p-4 text-left backdrop-blur"
            >
              <div className="text-2xl">📁</div>
              <div className="mt-2 font-medium">{folder.name}</div>
              <div className="text-xs text-slate-400">{folder._count?.files ?? 0} files</div>
            </button>
          ))}

          {files.map((file) => (
            <button
              key={file.id}
              className="rounded-2xl border border-white/10 bg-[rgba(28,28,33,0.7)] p-4 text-left backdrop-blur"
              onClick={() => setSelected(file)}
              onContextMenu={(e) => {
                e.preventDefault();
                setMenu({ x: e.clientX, y: e.clientY, file });
              }}
            >
              <div className="text-2xl">{iconForMime(file.mimeType)}</div>
              <div className="mt-2 truncate font-medium">{file.name}</div>
              <div className="mt-1 text-xs text-slate-400">{formatBytes(file.size)}</div>
              <div className="text-xs text-slate-400">{new Date(file.createdAt).toLocaleDateString()}</div>
            </button>
          ))}
        </div>
      )}

      {menu && (
        <div className="fixed z-50 min-w-40 rounded-xl border border-white/10 bg-[#1c1c21] p-1 text-sm" style={{ top: menu.y, left: menu.x }}>
          <button
            className="block w-full rounded-lg px-3 py-2 text-left hover:bg-white/10"
            onClick={async () => {
              const d = await client.getDownloadUrl(menu.file.id);
              window.open(d.downloadUrl, "_blank");
              setMenu(null);
            }}
          >
            Download
          </button>
          <button
            className="block w-full rounded-lg px-3 py-2 text-left hover:bg-white/10"
            onClick={() => {
              setSelected(menu.file);
              setShareOpen(true);
              setMenu(null);
            }}
          >
            Share
          </button>
          <button
            className="block w-full rounded-lg px-3 py-2 text-left text-red-300 hover:bg-white/10"
            onClick={async () => {
              await client.deleteFile(menu.file.id);
              setMenu(null);
              void refresh();
            }}
          >
            Delete
          </button>
        </div>
      )}

      <FileDetails file={selected} open={!!selected} onClose={() => setSelected(null)} onDeleted={() => void refresh()} />
      {selected && <ShareModal fileId={selected.id} open={shareOpen} onClose={() => setShareOpen(false)} />}
    </div>
  );
}
