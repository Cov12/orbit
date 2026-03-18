"use client";

import Sidebar from "@/components/Sidebar";

export default function SharedPage() {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
        <span className="material-symbols-outlined text-5xl text-slate-600 mb-4">group</span>
        <h2 className="text-lg font-semibold text-white mb-1">Shared Files</h2>
        <p className="text-sm text-slate-500 max-w-sm">
          Files you&apos;ve shared with others will appear here. Share a file from My Drive to get started.
        </p>
      </div>
    </div>
  );
}
