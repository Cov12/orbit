"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const SUBACCOUNTS_PATH = "/settings/subaccounts";

/**
 * Compose the hop that hands the user back to the app they came from.
 *
 * We do NOT navigate to `returnTo` directly: bouncing through
 * `/api/auth/refresh` mints a fresh Orbit JWT that already carries the
 * sub-account we just created, so the calling app resyncs for free instead of
 * waiting for its old token to expire.
 *
 * SECURITY: `returnTo` must already have been validated server-side by
 * `resolveReturnTo` (see src/lib/return-to.ts) — this component only ever
 * receives a value the server allowed. Encode it so the redirect target cannot
 * smuggle extra query params into the refresh URL.
 */
export function buildRefreshUrl(returnTo: string): string {
  return `/api/auth/refresh?redirect_uri=${encodeURIComponent(returnTo)}`;
}

/**
 * Inline error copy for a failed create. 403 is the real role gate (the API
 * decides, not the UI); 400 carries the API's own message (missing name,
 * duplicate, …) because it is more specific than anything we could invent.
 */
export function createErrorMessage(status: number, apiMessage?: string | null): string {
  if (status === 403) return "You need owner/admin access to add a sub-account";
  if (status === 400) return apiMessage || "Please check the sub-account name and try again";
  return "Something went wrong. Please try again.";
}

/**
 * Where the form sends the user once it is done — after a successful create OR
 * on cancel. Both exits are identical on purpose: if the user arrived from a
 * sibling app, they go back through the refresh hop (fresh JWT, session
 * re-established); otherwise they stay in Portal.
 */
export type ExitTarget =
  | { kind: "refresh"; url: string }
  | { kind: "portal"; path: string };

export function exitTarget(returnTo: string | null): ExitTarget {
  if (returnTo) return { kind: "refresh", url: buildRefreshUrl(returnTo) };
  return { kind: "portal", path: SUBACCOUNTS_PATH };
}

export type CreateResult = { ok: true } | { ok: false; message: string };

/**
 * POST /api/subaccounts with `{ name }` and nothing else.
 *
 * MULTI-TENANCY: the org is resolved server-side from the session
 * (`orbit_workspace` cookie + Clerk membership). The client never sends an org
 * or workspace id — doing so would let a URL choose the tenant.
 */
export async function createSubAccount(name: string): Promise<CreateResult> {
  let res: Response;
  try {
    res = await fetch("/api/subaccounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
  } catch {
    return { ok: false, message: "Something went wrong. Please try again." };
  }

  if (res.status === 201) return { ok: true };

  const data = await res.json().catch(() => ({}));
  return { ok: false, message: createErrorMessage(res.status, data?.error) };
}

interface SubAccountFormProps {
  /** Server-validated absolute URL, or null. Never a raw query param. */
  returnTo: string | null;
  /** UX only — the API's 403 is the enforcing gate. */
  isAdmin: boolean;
}

export function SubAccountForm({ returnTo, isAdmin }: SubAccountFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Used by both the success path and Cancel — see exitTarget.
  const leave = () => {
    const target = exitTarget(returnTo);
    if (target.kind === "refresh") {
      // Full page navigation, not router.push: /api/auth/refresh is a server
      // route that 302s off-origin to the calling app.
      window.location.href = target.url;
      return;
    }
    router.push(target.path);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmed = name.trim();
    if (!trimmed) {
      setError("Please enter a sub-account name");
      return;
    }

    setLoading(true);
    setError(null);

    const result = await createSubAccount(trimmed);
    if (!result.ok) {
      setError(result.message);
      setLoading(false);
      return;
    }

    leave();
  };

  if (!isAdmin) {
    return (
      <div className="glass p-6 space-y-4">
        <h2 className="text-lg font-semibold">Add a sub-account</h2>
        <p className="text-sm text-gray-400">
          Only workspace owners and admins can add sub-accounts. Ask an owner or admin of
          this workspace to create one for you.
        </p>
        <button
          type="button"
          onClick={leave}
          className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5"
        >
          Back
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="glass p-6 space-y-4">
      <h2 className="text-lg font-semibold">Add a sub-account</h2>

      <div>
        <label htmlFor="subaccount-name" className="block text-sm font-medium text-gray-300 mb-2">
          Sub-account name <span className="text-red-400">*</span>
        </label>
        <input
          id="subaccount-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Acme Client"
          autoFocus
          className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#2B2FFF] focus:border-transparent"
        />
        <p className="text-sm text-gray-500 mt-2">
          Sub-accounts keep each client&apos;s data, files, and AI memory separate within this
          workspace.
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={loading || !name.trim()}
          className="px-6 py-2.5 rounded-lg bg-[#2B2FFF] text-white font-medium hover:bg-[#2B2FFF]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Creating..." : "Create"}
        </button>
        <button
          type="button"
          onClick={leave}
          disabled={loading}
          className="px-4 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
