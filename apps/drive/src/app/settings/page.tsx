"use client";

import Sidebar from "@/components/Sidebar";
import QuotaBar from "@/components/QuotaBar";
import { UserProfile } from "@clerk/nextjs";

export default function SettingsPage() {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 overflow-y-auto p-6 md:p-8">
        <h1 className="text-xl font-bold text-white mb-6">Settings</h1>

        {/* Storage */}
        <div className="glass rounded-2xl p-6 mb-6 max-w-lg">
          <h2 className="text-sm font-semibold text-white mb-3">Storage Usage</h2>
          <QuotaBar />
        </div>

        {/* Profile */}
        <div className="max-w-2xl">
          <h2 className="text-sm font-semibold text-white mb-3">Account</h2>
          <UserProfile
            routing="hash"
            appearance={{
              elements: {
                rootBox: "w-full",
                card: "bg-transparent shadow-none border border-white/5 rounded-2xl",
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}
