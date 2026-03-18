"use client";

import { UserButton } from "@clerk/nextjs";

type Props = {
  onUpload: () => void;
  onNewFolder: () => void;
};

export default function TopBar({ onUpload, onNewFolder }: Props) {
  return (
    <header className="h-14 border-b border-white/5 flex items-center justify-between px-4 md:px-6 bg-[#0f0f13]">
      {/* Mobile logo */}
      <div className="flex items-center gap-2 md:hidden">
        <div className="w-7 h-7 rounded-lg bg-[#6961ff] flex items-center justify-center">
          <span className="material-symbols-outlined text-white text-sm">cloud</span>
        </div>
        <span className="font-bold text-sm text-white">Orbit Drive</span>
      </div>

      {/* Search placeholder */}
      <div className="hidden md:flex items-center gap-2 rounded-xl bg-white/5 border border-white/5 px-3 py-2 w-72">
        <span className="material-symbols-outlined text-slate-500 text-lg">search</span>
        <span className="text-sm text-slate-500">Search files...</span>
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
        <div className="ml-2">
          <UserButton
            appearance={{
              elements: {
                avatarBox: "w-8 h-8",
              },
            }}
          />
        </div>
      </div>
    </header>
  );
}
