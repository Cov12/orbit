"use client";
import { useState } from "react";

const APPS = ["WORKPIPE", "ATRIUM", "DRIVE", "CONDUCTOR"] as const;
type App = (typeof APPS)[number];

export function AppAccessToggles({
  orgId,
  initial,
}: {
  orgId: string;
  initial: Record<App, boolean>;
}) {
  const [state, setState] = useState<Record<App, boolean>>(initial);
  const [busy, setBusy] = useState<App | null>(null);

  const toggle = async (app: App) => {
    const next = !state[app];
    setBusy(app);
    // Optimistic; revert on failure.
    setState((s) => ({ ...s, [app]: next }));
    try {
      const res = await fetch(`/api/admin/orgs/${orgId}/app-access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ app, enabled: next }),
      });
      if (!res.ok) throw new Error("failed");
    } catch {
      setState((s) => ({ ...s, [app]: !next }));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {APPS.map((app) => {
        const on = state[app];
        return (
          <button
            key={app}
            type="button"
            disabled={busy === app}
            onClick={() => toggle(app)}
            title={`${on ? "Disable" : "Enable"} ${app}`}
            className={`rounded-full px-2 py-0.5 text-xs transition-colors disabled:opacity-50 ${
              on
                ? "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                : "bg-neutral-800 text-neutral-500 hover:bg-neutral-700 hover:text-neutral-300"
            }`}
          >
            {app}
          </button>
        );
      })}
    </div>
  );
}
