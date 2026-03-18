"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import QuotaBar from "./QuotaBar";

const navItems = [
  { href: "/drive", icon: "folder_open", label: "My Drive" },
  { href: "/shared", icon: "group", label: "Shared" },
  { href: "/settings", icon: "settings", label: "Settings" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex flex-col w-60 border-r border-white/5 bg-[#0f0f13] p-4">
      {/* Logo */}
      <div className="flex items-center gap-2.5 mb-8 px-2">
        <div className="w-8 h-8 rounded-lg bg-[#6961ff] flex items-center justify-center">
          <span className="material-symbols-outlined text-white text-lg">cloud</span>
        </div>
        <span className="font-bold text-white tracking-tight">Orbit Drive</span>
      </div>

      {/* Nav */}
      <nav className="space-y-1 flex-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                isActive
                  ? "bg-[#6961ff]/10 text-[#6961ff]"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <span className="material-symbols-outlined text-lg">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Quota */}
      <div className="mt-auto pt-4 border-t border-white/5">
        <p className="text-xs text-slate-500 mb-2 px-1">Storage</p>
        <QuotaBar />
      </div>
    </aside>
  );
}
