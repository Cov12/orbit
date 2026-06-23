"use client";

import { UploadDropzone } from "@/lib/uploadthing";

type Props = {
  value?: string;
  onChange: (url?: string) => void;
};

/**
 * Workspace logo capture for onboarding.
 *
 * Ported from WorkPipe's FileUpload UX (dropzone → preview → remove), themed to
 * the onboarding wizard's dark palette. On a successful upload the public
 * UploadThing URL (`ufsUrl`) is handed back via onChange; the wizard persists it
 * to Organization.logoUrl at workspace creation.
 */
export default function LogoUpload({ value, onChange }: Props) {
  if (value) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={value}
          alt="Workspace logo"
          className="h-32 w-32 rounded-lg object-contain"
        />
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
    <UploadDropzone
      endpoint="orgLogo"
      onClientUploadComplete={(res) => {
        onChange(res?.[0]?.ufsUrl);
      }}
      onUploadError={(error: Error) => {
        console.error("[Onboarding] Logo upload failed:", error);
      }}
      // Container-level classes only — Portal is on Tailwind v4 without the
      // UploadThing `withUt` plugin, so `ut-*` variant classes would be no-ops.
      // The dropzone keeps its default control styling (interim host).
      className="rounded-xl border border-dashed border-white/15 bg-white/5 py-8"
    />
  );
}
