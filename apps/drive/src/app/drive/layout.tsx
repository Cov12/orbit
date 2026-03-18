import { Suspense } from "react";
import Sidebar from "@/components/Sidebar";

export default function DriveLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <Suspense fallback={<div className="flex-1 flex items-center justify-center"><div className="w-8 h-8 border-2 border-[#6961ff] border-t-transparent rounded-full animate-spin" /></div>}>
        {children}
      </Suspense>
    </div>
  );
}
