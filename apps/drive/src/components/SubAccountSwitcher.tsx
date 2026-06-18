"use client";

import { useEffect, useRef, useState } from "react";
import { driveClient, type SubAccount } from "@/lib/drive-client";

type Props = {
  /** Called after the active sub-account changes, so the file view can reload. */
  onChange?: () => void;
};

const BUSINESS_LABEL = "Business (all)";

export default function SubAccountSwitcher({ onChange }: Props) {
  const [subAccounts, setSubAccounts] = useState<SubAccount[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    driveClient
      .listSubAccounts()
      .then((r) => {
        setSubAccounts(r.subAccounts);
        setActiveId(r.activeSubAccountId);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, []);

  // Nothing to switch between — hide the control entirely.
  if (!loaded || subAccounts.length === 0) return null;

  const activeName = activeId
    ? subAccounts.find((s) => s.id === activeId)?.name ?? "Sub-account"
    : BUSINESS_LABEL;

  async function select(id: string | null) {
    setOpen(false);
    if (id === activeId) return;
    setActiveId(id);
    try {
      await driveClient.selectSubAccount(id);
      onChange?.();
    } catch {
      /* noop — keep optimistic selection */
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-300 hover:text-white bg-white/5 border border-white/5 hover:bg-white/10 transition"
      >
        <span className="material-symbols-outlined text-sm text-[#6961ff]">workspaces</span>
        <span className="max-w-[10rem] truncate">{activeName}</span>
        <span className="material-symbols-outlined text-sm text-slate-500">expand_more</span>
      </button>

      {open && (
        <div className="absolute left-0 mt-1 w-56 z-50 rounded-xl bg-[#15151b] border border-white/10 shadow-xl py-1">
          <SwitcherItem
            label={BUSINESS_LABEL}
            hint="Workspace-level files"
            active={activeId === null}
            onClick={() => select(null)}
          />
          <div className="my-1 border-t border-white/5" />
          {subAccounts.map((s) => (
            <SwitcherItem
              key={s.id}
              label={s.name}
              active={activeId === s.id}
              onClick={() => select(s.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SwitcherItem({
  label,
  hint,
  active,
  onClick,
}: {
  label: string;
  hint?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-white/5 transition"
    >
      <span className="min-w-0">
        <span className="block text-sm text-white truncate">{label}</span>
        {hint && <span className="block text-[11px] text-slate-500">{hint}</span>}
      </span>
      {active && (
        <span className="material-symbols-outlined text-base text-[#6961ff]">check</span>
      )}
    </button>
  );
}
