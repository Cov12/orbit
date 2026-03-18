"use client";

import { useState } from "react";
import { useDriveClient } from "@/lib/drive-client";

export function NewFolderModal({ parentId, onCreated }: { parentId?: string | null; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const client = useDriveClient();

  const submit = async () => {
    if (!name.trim()) return;
    setLoading(true);
    await client.createFolder(name.trim(), parentId);
    setLoading(false);
    setName("");
    setOpen(false);
    onCreated();
  };

  return (
    <>
      <button className="rounded-xl border border-white/10 px-4 py-2 text-sm" onClick={() => setOpen(true)}>
        New Folder
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[rgba(28,28,33,0.9)] p-6 backdrop-blur">
            <h3 className="text-lg font-semibold">Create folder</h3>
            <input
              className="mt-4 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2"
              placeholder="Folder name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button className="rounded-xl border border-white/10 px-3 py-2" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button className="rounded-xl bg-[#6961ff] px-3 py-2" onClick={() => void submit()} disabled={loading}>
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
