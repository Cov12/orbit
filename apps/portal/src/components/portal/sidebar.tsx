"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { Logo } from "@/components/shared/logo";
import { WorkspaceSwitcher } from "@/components/portal/workspace-switcher";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: "◆" },
  { href: "/apps", label: "Apps", icon: "⊞" },
  { href: "/billing", label: "Billing", icon: "◈" },
  { href: "/settings", label: "Settings", icon: "⚙" },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`${
        collapsed ? "w-16" : "w-64"
      } border-r border-white/10 flex flex-col h-screen sticky top-0 transition-all duration-300`}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-white/10">
        <Logo />
        {!collapsed && <span className="font-semibold text-lg">Orbit Portal</span>}
      </div>

      {/* Workspace Switcher */}
      {!collapsed && (
        <div className="px-4 py-3 border-b border-white/10">
          <WorkspaceSwitcher />
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                collapsed ? "justify-center" : ""
              } ${
                isActive
                  ? "bg-[#2B2FFF]/15 text-white border border-[#2B2FFF]/30"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
              title={collapsed ? item.label : undefined}
            >
              <span className="text-base">{item.icon}</span>
              {!collapsed && item.label}
            </Link>
          );
        })}
      </nav>

      {/* Toggle Button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="mx-3 mb-2 p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors flex items-center justify-center"
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        <span className="text-sm">{collapsed ? "»" : "«"}</span>
      </button>

      {/* User */}
      <div className={`${collapsed ? "px-2" : "px-4"} py-4 border-t border-white/10 flex justify-center`}>
        <UserButton
          afterSignOutUrl="/"
          appearance={{
            elements: {
              avatarBox: "w-8 h-8",
            },
          }}
        />
      </div>
    </aside>
  );
}
