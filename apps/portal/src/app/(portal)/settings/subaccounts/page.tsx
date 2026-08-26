import Link from "next/link";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { getCurrentOrgEntitlements } from "@/lib/org-entitlements";

/**
 * /settings/subaccounts — the workspace's sub-accounts.
 *
 * Server component: the workspace (and the caller's role in it) is resolved
 * from the session via getCurrentOrgEntitlements — the same single resolver the
 * dashboard and the app landing pages use — so the list can never be scoped by
 * anything the client sends.
 */
export default async function SubAccountsSettingsPage() {
  const org = await getCurrentOrgEntitlements();

  // No membership: the portal layout already funnels these users into the
  // mandatory onboarding wizard; mirror that rather than rendering an empty page.
  if (!org) {
    redirect("/onboarding/new-workspace");
  }

  // Same read as GET /api/subaccounts: ACTIVE rows for THIS org only.
  const subAccounts = await db.subAccount.findMany({
    where: { orgId: org.orgId, status: "ACTIVE" },
    select: { id: true, name: true, slug: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  // OWNER/ADMIN gate, identical to the team page's canManageTeam. Everyone sees
  // the list; only owners/admins get the add affordance. The API's 403 is the
  // enforcing gate — this only keeps the UI honest.
  const canManage = org.isPlatformAdmin;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Sub-accounts</h1>
          <p className="text-gray-400 mt-1">
            Separate spaces for clients, locations, or brands inside{" "}
            <span className="text-white">{org.orgName}</span>.
          </p>
        </div>
        {canManage && (
          <Link
            href="/settings/subaccounts/new"
            className="shrink-0 px-6 py-2.5 rounded-lg bg-[#2B2FFF] text-white font-medium hover:bg-[#2B2FFF]/90 transition-colors"
          >
            Add sub-account
          </Link>
        )}
      </div>

      <div className="glass p-6">
        <h2 className="text-lg font-semibold mb-4">
          {subAccounts.length} sub-account{subAccounts.length === 1 ? "" : "s"}
        </h2>

        {subAccounts.length === 0 ? (
          <p className="text-sm text-gray-500">
            No sub-accounts yet. This workspace operates at the business level.
          </p>
        ) : (
          <div className="space-y-3">
            {subAccounts.map((subAccount: { id: string; name: string; slug: string; createdAt: Date }) => (
              <div
                key={subAccount.id}
                className="flex items-center justify-between p-3 rounded-lg bg-white/5"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#2B2FFF]/20 flex items-center justify-center text-[#2B2FFF] font-medium">
                    {subAccount.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-white font-medium">{subAccount.name}</p>
                    <p className="text-sm text-gray-500 font-mono">{subAccount.slug}</p>
                  </div>
                </div>
                <span className="text-sm text-gray-500">
                  Added {new Date(subAccount.createdAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {!canManage && (
        <p className="text-sm text-gray-500">
          Only workspace owners and admins can add sub-accounts.
        </p>
      )}
    </div>
  );
}
