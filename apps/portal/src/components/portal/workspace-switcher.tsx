"use client";

import { useEffect, useState } from "react";

interface Workspace {
  id: string;
  name: string;
  slug: string;
  role: string;
}

export function WorkspaceSwitcher() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [current, setCurrent] = useState<Workspace | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/workspaces")
      .then((r) => r.json())
      .then((data) => {
        setWorkspaces(data.workspaces || []);
        setCurrent(data.current || data.workspaces?.[0] || null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-gray-500 animate-pulse">
        Loading...
      </div>
    );
  }

  if (!current) {
    return (
      <div className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-gray-400">
        No workspace
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => workspaces.length > 1 && setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white hover:bg-white/10 transition-colors"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-md bg-[#2B2FFF]/20 flex items-center justify-center text-xs font-bold text-[#2B2FFF] shrink-0">
            {current.name.charAt(0).toUpperCase()}
          </div>
          <span className="truncate font-medium">{current.name}</span>
        </div>
        {workspaces.length > 1 && (
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {open && workspaces.length > 1 && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-lg bg-[#1a1a1f] border border-white/10 shadow-xl overflow-hidden">
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                onClick={() => {
                  setCurrent(ws);
                  setOpen(false);
                  // Store selection and reload to pick up new context
                  fetch("/api/workspaces/select", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ workspaceId: ws.id }),
                  }).then(() => window.location.reload());
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left hover:bg-white/5 transition-colors ${
                  ws.id === current.id ? "bg-white/5 text-white" : "text-gray-300"
                }`}
              >
                <div className="w-7 h-7 rounded-md bg-[#2B2FFF]/20 flex items-center justify-center text-xs font-bold text-[#2B2FFF] shrink-0">
                  {ws.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium">{ws.name}</p>
                  <p className="text-xs text-gray-500 capitalize">{ws.role.toLowerCase()}</p>
                </div>
                {ws.id === current.id && (
                  <svg className="w-4 h-4 text-[#2B2FFF] ml-auto shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
