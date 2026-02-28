"use client";

interface AppCardProps {
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  status: "active" | "inactive" | "coming_soon";
  url?: string;
}

const statusBadge = {
  active: { label: "Active", class: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  inactive: { label: "Upgrade Required", class: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  coming_soon: { label: "Coming Soon", class: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
};

export function AppCard({ name, description, icon, color, status, url }: AppCardProps) {
  const badge = statusBadge[status];

  return (
    <div className="glass-hover p-6 space-y-4">
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

      {status === "active" && url ? (
        <a
          href={url}
          className="inline-flex items-center gap-2 text-sm font-medium transition-colors hover:opacity-80"
          style={{ color }}
        >
          Launch →
        </a>
      ) : status === "inactive" ? (
        <a
          href="/billing"
          className="inline-flex items-center gap-2 text-sm font-medium text-amber-400 hover:text-amber-300 transition-colors"
        >
          View Plans →
        </a>
      ) : null}
    </div>
  );
}
