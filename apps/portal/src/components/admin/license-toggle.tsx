"use client";
import { useState } from "react";

/**
 * Super-admin per-org license toggle. Flips Organization.licensed via
 * POST /api/admin/orgs/:orgId/license. When on, the org is fully entitled with
 * no subscription (OR'd with the global ORBIT_LICENSE_MODE env).
 */
export function LicenseToggle({
  orgId,
  initial,
}: {
  orgId: string;
  initial: boolean;
}) {
  const [licensed, setLicensed] = useState(initial);
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    const next = !licensed;
    setBusy(true);
    // Optimistic; revert on failure.
    setLicensed(next);
    try {
      const res = await fetch(`/api/admin/orgs/${orgId}/license`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licensed: next }),
      });
      if (!res.ok) throw new Error("failed");
    } catch {
      setLicensed(!next);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      disabled={busy}
      onClick={toggle}
      title={licensed ? "Revoke license" : "Grant license"}
      className={`rounded-full px-2 py-0.5 text-xs transition-colors disabled:opacity-50 ${
        licensed
          ? "bg-amber-500/15 text-amber-300 hover:bg-amber-500/25"
          : "bg-neutral-800 text-neutral-500 hover:bg-neutral-700 hover:text-neutral-300"
      }`}
    >
      {licensed ? "Licensed" : "Unlicensed"}
    </button>
  );
}
