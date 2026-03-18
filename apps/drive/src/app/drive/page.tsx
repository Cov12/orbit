"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { DriveFile, DriveFolder, driveClient, formatFileSize, getFileIcon, timeAgo } from "@/lib/drive-client";
import TopBar from "@/components/TopBar";
import UploadModal from "@/components/UploadModal";
import NewFolderModal from "@/components/NewFolderModal";
import FileDetails from "@/components/FileDetails";
import ShareModal from "@/components/ShareModal";

export default function DrivePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const folderId = searchParams.get("folderId");

  const [files, setFiles] = useState<DriveFile[]>([]);
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedFile, setSelectedFile] = useState<DriveFile | null>(null);
  const [shareFileId, setShareFileId] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; file: DriveFile } | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [fileRes, folderRes] = await Promise.all([
        driveClient.listFiles(folderId),
        driveClient.listFolders(folderId),
      ]);
      setFiles(fileRes.files);
      setFolders(folderRes.folders);
    } catch {
      // silently fail — Clerk may not be ready
    } finally {
      setLoading(false);
    }
  }, [folderId]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    const handler = () => setContextMenu(null);
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, []);

  function navigateToFolder(id: string) {
    router.push(`/drive?folderId=${id}`);
  }

  async function handleDownload(fileId: string) {
    try {
      const { downloadUrl } = await driveClient.getDownloadUrl(fileId);
      window.open(downloadUrl, "_blank");
    } catch { /* noop */ }
  }

  async function handleDelete(fileId: string) {
    if (!confirm("Delete this file?")) return;
    try {
      await driveClient.deleteFile(fileId);
      setSelectedFile(null);
      refresh();
    } catch { /* noop */ }
  }

  function handleContextMenu(e: React.MouseEvent, file: DriveFile) {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, file });
  }

  const isEmpty = !loading && files.length === 0 && folders.length === 0;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <TopBar onUpload={() => setShowUpload(true)} onNewFolder={() => setShowNewFolder(true)} />

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {/* Breadcrumbs */}
        <div className="flex items-center gap-2 mb-4">
          <button onClick={() => router.push("/drive")} className={`text-sm font-medium transition ${!folderId ? "text-white" : "text-slate-400 hover:text-white"}`}>
            My Drive
          </button>
          {folderId && (
            <>
              <span className="text-slate-600">/</span>
              <span className="text-sm text-white font-medium">Subfolder</span>
            </>
          )}
          <div className="flex-1" />
          <div className="flex items-center gap-1 rounded-lg bg-white/5 p-0.5">
            <button onClick={() => setViewMode("grid")} className={`p-1.5 rounded-md transition ${viewMode === "grid" ? "bg-white/10 text-white" : "text-slate-500"}`}>
              <span className="material-symbols-outlined text-sm">grid_view</span>
            </button>
            <button onClick={() => setViewMode("list")} className={`p-1.5 rounded-md transition ${viewMode === "list" ? "bg-white/10 text-white" : "text-slate-500"}`}>
              <span className="material-symbols-outlined text-sm">view_list</span>
            </button>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className={viewMode === "grid" ? "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3" : "space-y-2"}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-xl bg-white/5 animate-pulse" style={{ height: viewMode === "grid" ? 140 : 48 }} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {isEmpty && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <span className="material-symbols-outlined text-5xl text-slate-600 mb-4">cloud_upload</span>
            <p className="text-slate-400 font-medium mb-1">No files yet</p>
            <p className="text-sm text-slate-600 mb-4">Upload your first file to get started</p>
            <button
              onClick={() => setShowUpload(true)}
              className="px-5 py-2 rounded-xl text-sm font-semibold bg-[#6961ff] text-white hover:bg-[#5a52e0] transition"
            >
              Upload Files
            </button>
          </div>
        )}

        {!loading && !isEmpty && (
          <>
            {/* Folders */}
            {folders.length > 0 && (
              <div className="mb-6">
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-2">Folders</p>
                <div className={viewMode === "grid" ? "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3" : "space-y-1"}>
                  {folders.map((folder) => (
                    <button
                      key={folder.id}
                      onClick={() => navigateToFolder(folder.id)}
                      className={`text-left transition ${
                        viewMode === "grid"
                          ? "glass rounded-xl p-4 hover:bg-white/5"
                          : "flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-white/5 w-full"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[#6961ff]">folder</span>
                      <span className={`text-sm font-medium truncate ${viewMode === "grid" ? "block mt-2" : "ml-1"}`}>{folder.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Files */}
            {files.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-2">Files</p>
                {viewMode === "grid" ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                    {files.map((file) => (
                      <div
                        key={file.id}
                        onClick={() => setSelectedFile(file)}
                        onContextMenu={(e) => handleContextMenu(e, file)}
                        className="glass rounded-xl p-4 cursor-pointer hover:bg-white/5 transition group"
                      >
                        <div className="w-10 h-10 rounded-lg bg-[#6961ff]/10 flex items-center justify-center mb-3">
                          <span className="material-symbols-outlined text-[#6961ff]">{getFileIcon(file.mimeType)}</span>
                        </div>
                        <p className="text-sm font-medium truncate">{file.name}</p>
                        <p className="text-xs text-slate-500 mt-1">{formatFileSize(file.size)} · {timeAgo(file.createdAt)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {files.map((file) => (
                      <div
                        key={file.id}
                        onClick={() => setSelectedFile(file)}
                        onContextMenu={(e) => handleContextMenu(e, file)}
                        className="flex items-center gap-3 rounded-xl px-3 py-2.5 cursor-pointer hover:bg-white/5 transition"
                      >
                        <span className="material-symbols-outlined text-lg text-[#6961ff]">{getFileIcon(file.mimeType)}</span>
                        <span className="text-sm font-medium flex-1 truncate">{file.name}</span>
                        <span className="text-xs text-slate-500 hidden sm:block">{formatFileSize(file.size)}</span>
                        <span className="text-xs text-slate-500">{timeAgo(file.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 glass rounded-xl py-1 min-w-[160px] shadow-xl"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button onClick={() => { handleDownload(contextMenu.file.id); setContextMenu(null); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 transition">
            <span className="material-symbols-outlined text-sm">download</span> Download
          </button>
          <button onClick={() => { setShareFileId(contextMenu.file.id); setContextMenu(null); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 transition">
            <span className="material-symbols-outlined text-sm">share</span> Share
          </button>
          <button onClick={() => { handleDelete(contextMenu.file.id); setContextMenu(null); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition">
            <span className="material-symbols-outlined text-sm">delete</span> Delete
          </button>
        </div>
      )}

      {/* Modals */}
      {showUpload && <UploadModal folderId={folderId} onUploaded={refresh} onClose={() => setShowUpload(false)} />}
      {showNewFolder && <NewFolderModal parentId={folderId} onCreated={refresh} onClose={() => setShowNewFolder(false)} />}
      {selectedFile && (
        <FileDetails
          file={selectedFile}
          onClose={() => setSelectedFile(null)}
          onDownload={handleDownload}
          onShare={(id) => { setShareFileId(id); setSelectedFile(null); }}
          onDelete={handleDelete}
        />
      )}
      {shareFileId && (
        <ShareModal
          fileId={shareFileId}
          fileName={files.find((f) => f.id === shareFileId)?.name ?? ""}
          onClose={() => setShareFileId(null)}
        />
      )}
    </div>
  );
}
