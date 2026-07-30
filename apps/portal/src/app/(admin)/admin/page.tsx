import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { AdminLogoutButton } from "@/components/admin/logout-button";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const admin = await requireAdmin();

  const orgs = await db.organization.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      appAccess: { orderBy: { app: "asc" } },
      subscriptions: {
        where: { status: { in: ["ACTIVE", "TRIALING"] } },
        select: { app: true, plan: true, status: true },
      },
      _count: { select: { members: true } },
    },
  });

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Organizations</h1>
          <p className="text-sm text-neutral-400">
            {orgs.length} total · signed in as {admin.email}
          </p>
        </div>
        <AdminLogoutButton />
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-900 text-left text-neutral-400">
            <tr>
              <th className="px-4 py-3 font-medium">Organization</th>
              <th className="px-4 py-3 font-medium">Members</th>
              <th className="px-4 py-3 font-medium">App access</th>
              <th className="px-4 py-3 font-medium">Subscriptions</th>
            </tr>
          </thead>
          <tbody>
            {orgs.map((org) => (
              <tr key={org.id} className="border-t border-neutral-800">
                <td className="px-4 py-3">
                  <div className="font-medium">{org.name}</div>
                  <div className="text-xs text-neutral-500">{org.slug}</div>
                </td>
                <td className="px-4 py-3 tabular-nums text-neutral-300">
                  {org._count.members}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {org.appAccess.length === 0 ? (
                      <span className="text-neutral-600">—</span>
                    ) : (
                      org.appAccess.map((a) => (
                        <span
                          key={a.app}
                          className={`rounded-full px-2 py-0.5 text-xs ${
                            a.enabled
                              ? "bg-emerald-500/15 text-emerald-300"
                              : "bg-neutral-800 text-neutral-500 line-through"
                          }`}
                        >
                          {a.app}
                        </span>
                      ))
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-neutral-300">
                  {org.subscriptions.length === 0 ? (
                    <span className="text-neutral-600">Free</span>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {org.subscriptions.map((s) => (
                        <span
                          key={s.app}
                          className="rounded-full bg-neutral-800 px-2 py-0.5 text-xs text-neutral-300"
                        >
                          {s.app} {s.plan}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {orgs.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-neutral-500"
                >
                  No organizations yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-neutral-600">
        Read-only. Per-org app-access controls arrive in the next release.
      </p>
    </div>
  );
}
