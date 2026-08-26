import { redirect } from "next/navigation";

import { SubAccountForm } from "@/components/portal/subaccount-form";
import { getCurrentOrgEntitlements } from "@/lib/org-entitlements";
import { resolveReturnTo } from "@/lib/return-to";

/**
 * /settings/subaccounts/new — the reusable "add sub-account" page.
 *
 * Sibling apps (WorkPipe, Atrium, …) deep-link here with
 * `?returnTo=<their url>`; after the create we bounce the user through
 * /api/auth/refresh so they land back in the calling app holding a fresh JWT
 * that already knows about the new sub-account.
 *
 * SECURITY: `returnTo` is validated HERE, on the server, before it can reach
 * the client. resolveReturnTo returns null for anything off the allowlist
 * (javascript:, unknown origins, malformed input), so the form never holds an
 * attacker-controlled URL — see src/lib/return-to.ts for why that redirect is
 * credential-bearing.
 */
export default async function NewSubAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const params = await searchParams;
  const rawReturnTo = Array.isArray(params.returnTo) ? params.returnTo[0] : params.returnTo;
  const returnTo = resolveReturnTo(rawReturnTo);

  const org = await getCurrentOrgEntitlements();
  if (!org) {
    redirect("/onboarding/new-workspace");
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Add a sub-account</h1>
        <p className="text-gray-400 mt-1">
          Create a new sub-account in <span className="text-white">{org.orgName}</span>.
        </p>
      </div>

      <SubAccountForm returnTo={returnTo} isAdmin={org.isPlatformAdmin} />
    </div>
  );
}
