"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton, useOrganization } from "@clerk/nextjs";
import { QuotaBar } from "@/components/QuotaBar";
import { UploadButton } from "@/components/UploadButton";

const nav = [
  { href: "/drive", label: "Drive" },
  { href: "/shared", label: "Shared" },
  { href: "/trash", label: "Trash" },
  { href: "/settings", label: "Settings" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { organization } = useOrganization();

  return (
    <div className="min-h-screen bg-[#0f0f13] text-white">
      <div className="flex min-h-screen">
        <aside className="w-64 border-r border-white/10 bg-[rgba(28,28,33,0.7)] p-4 backdrop-blur max-md:hidden">
          <div className="mb-6 text-lg font-semibold">Orbit Drive</div>
          <nav className="space-y-1">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-xl px-3 py-2 text-sm ${
                  pathname === item.href ? "bg-[#6961ff] text-white" : "text-slate-300 hover:bg-white/10"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-white/10 bg-[rgba(15,15,19,0.85)] p-4 backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs text-slate-400">Organization</p>
                <p className="font-medium">{organization?.name ?? "No Organization"}</p>
              </div>
              <div className="flex items-center gap-3">
                {pathname.startsWith("/drive") && <UploadButton />}
                <QuotaBar />
                <UserButton />
              </div>
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
