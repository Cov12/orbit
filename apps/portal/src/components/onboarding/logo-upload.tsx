"use client";

import { useRef, useState } from "react";

type Props = {
  value?: string;
  onChange: (url?: string) => void;
};

const MAX_BYTES = 4 * 1024 * 1024; // 4MB

/**
 * Workspace logo capture for onboarding.
 *
 * Self-contained dropzone (drag-or-click → auto-upload → preview → remove),
 * themed to the wizard's dark palette. Uploads to our own R2-backed endpoint
 * (POST /api/branding/logo) and hands the returned public URL back via onChange;
 * the wizard persists it to Organization.logoUrl at workspace creation.
 */
export default function LogoUpload({ value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  async function upload(file?: File | null) {
    if (!file) return;
    setError(null);

    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Image must be under 4MB.");
      return;
    }

    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/branding/logo", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Upload failed");
      onChange(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  if (value) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={value} alt="Workspace logo" className="h-32 w-32 rounded-lg object-contain" />
        <button
          type="button"
          onClick={() => onChange("")}
          className="flex items-center gap-1.5 text-sm text-gray-400 transition-colors hover:text-white"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Remove logo
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          upload(e.dataTransfer.files?.[0]);
        }}
        disabled={uploading}
        className={`flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-8 text-center transition-colors ${
          dragging ? "border-[#2B2FFF] bg-[#2B2FFF]/10" : "border-white/15 bg-white/5 hover:border-white/30"
        } ${uploading ? "cursor-wait opacity-70" : "cursor-pointer"}`}
      >
        <svg className="h-7 w-7 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 16V4m0 0L8 8m4-4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2"
          />
        </svg>
        <span className="text-sm text-gray-300">
          {uploading ? "Uploading…" : "Drag a logo here, or click to browse"}
        </span>
        <span className="text-xs text-gray-500">PNG, JPEG, WebP, SVG or GIF · up to 4MB</span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          upload(e.target.files?.[0]);
          // reset so re-selecting the same file fires onChange again
          e.target.value = "";
        }}
      />

      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </div>
  );
}
