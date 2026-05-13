"use client";

import Link from "next/link";

interface AppCardProps {
  name: string;
  slug: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  status: "active" | "inactive" | "coming_soon" | "bundled" | "coming_online";
  url?: string;
}

const statusBadge = {
  active: { label: "Active", class: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  inactive: { label: "Upgrade Required", class: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  coming_soon: { label: "Coming Soon", class: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
  bundled: { label: "Included with Atrium", class: "bg-emerald-400/10 text-emerald-300 border-emerald-400/20 italic" },
  coming_online: { label: "Coming online", class: "bg-amber-400/10 text-amber-300 border-amber-400/30" },
};

export function AppCard({ name, slug, description, icon, color, status }: AppCardProps) {
  const badge = statusBadge[status];
  const Wrapper = slug ? Link : "div";
  const wrapperProps = slug ? { href: `/apps/${slug}`, className: "block" } : { className: "block" };

  return (
    <Wrapper {...(wrapperProps as any)}>
      <div className={`glass-hover p-6 space-y-4 ${slug ? "cursor-pointer" : ""}`}>
        <div className="flex items-start justify-between">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${color}20` }}
          >
            <div style={{ color }}>{icon}</div>
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-full border ${badge.class}`}>
            {badge.label}
          </span>
        </div>

        <div>
          <h3 className="font-semibold text-lg">{name}</h3>
          <p className="text-sm text-gray-400 mt-1">{description}</p>
        </div>

        {slug && (
          <span
            className="inline-flex items-center gap-2 text-sm font-medium transition-colors"
            style={{ color }}
          >
            View Details →
          </span>
        )}
      </div>
    </Wrapper>
  );
}
