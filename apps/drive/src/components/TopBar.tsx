"use client";

import SubAccountSwitcher from "@/components/SubAccountSwitcher";
import { useOrgBranding } from "@/components/OrgBrandingProvider";

type Props = {
  onUpload: () => void;
  onNewFolder: () => void;
  userName?: string;
  /** Reload the file view after the active sub-account changes. */
  onScopeChange?: () => void;
};

export default function TopBar({ onUpload, onNewFolder, userName, onScopeChange }: Props) {
  const { logo: orgLogo, name: orgName } = useOrgBranding();
  const initials = (userName || "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="h-14 border-b border-white/5 flex items-center justify-between px-4 md:px-6 bg-[#0f0f13]">
      {/* Mobile brand — org logo when available, else default Orbit Drive mark */}
      <div className="flex items-center gap-2 md:hidden">
        {orgLogo ? (
          <>
            {/* Plain <img> (not next/image) so no remotePatterns config is needed */}
            <img
              src={orgLogo}
              alt={orgName || "Organization logo"}
              className="h-7 w-auto max-w-[128px] rounded-lg object-contain"
            />
            {orgName && (
              <span className="font-bold text-sm text-white truncate max-w-[128px]">{orgName}</span>
            )}
          </>
        ) : (
          <>
            <div className="w-7 h-7 rounded-lg bg-[#6961ff] flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-sm">cloud</span>
            </div>
            <span className="font-bold text-sm text-white">Orbit Drive</span>
          </>
        )}
      </div>

      {/* Search + sub-account scope */}
      <div className="hidden md:flex items-center gap-2">
        <div className="flex items-center gap-2 rounded-xl bg-white/5 border border-white/5 px-3 py-2 w-72">
          <span className="material-symbols-outlined text-slate-500 text-lg">search</span>
          <span className="text-sm text-slate-500">Search files...</span>
        </div>
        <SubAccountSwitcher onChange={onScopeChange} />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={onNewFolder}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 border border-white/5 transition"
        >
          <span className="material-symbols-outlined text-sm">create_new_folder</span>
          Folder
        </button>
        <button
          onClick={onUpload}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold bg-[#6961ff] text-white hover:bg-[#5a52e0] transition"
        >
          <span className="material-symbols-outlined text-sm">upload</span>
          Upload
        </button>
        <a
          href={`${process.env.NEXT_PUBLIC_PORTAL_URL || "https://portal.orbit.example"}/settings`}
          className="ml-2 w-8 h-8 rounded-full bg-[#6961ff]/20 flex items-center justify-center text-xs font-bold text-[#6961ff] hover:bg-[#6961ff]/30 transition cursor-pointer"
          title={userName || "Account"}
        >
          {initials}
        </a>
      </div>
    </header>
  );
}
