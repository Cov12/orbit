"use client";

import { useState } from "react";
import { UploadModal } from "@/components/UploadModal";

export function UploadButton({ folderId, onUploaded }: { folderId?: string | null; onUploaded?: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className="rounded-xl bg-[#6961ff] px-4 py-2 text-sm font-semibold" onClick={() => setOpen(true)}>
        Upload
      </button>
      <UploadModal
        open={open}
        folderId={folderId}
        onClose={() => setOpen(false)}
        onComplete={() => {
          onUploaded?.();
        }}
      />
    </>
  );
}
