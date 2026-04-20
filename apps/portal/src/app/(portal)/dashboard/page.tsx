import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { AppCard } from "@/components/portal/app-card";

async function getDashboardData(userId: string) {
  const member = await db.member.findFirst({
    where: { clerkUserId: userId },
    include: {
      org: {
        include: {
          members: true,
          appAccess: true,
          subscriptions: { where: { status: { in: ["ACTIVE", "TRIALING"] } } },
        },
      },
    },
  });

  if (!member?.org) {
    return { plan: "Free", teamCount: 1, activeApps: 0, appStatuses: {} as Record<string, boolean> };
  }

  const org = member.org;
  const appStatuses: Record<string, boolean> = {};
  for (const access of org.appAccess) {
    const hasSub = org.subscriptions.some((s) => s.app === access.app);
    const isFree = access.app === "DRIVE"; // Drive is always free
    appStatuses[access.app] = access.enabled && (hasSub || isFree);
  }

  // Find the highest-tier plan name
  const planNames: Record<string, number> = { FREE: 0, STARTER: 1, PRO: 2, BUSINESS: 3, GROWTH: 4, ENTERPRISE: 5 };
  const bestSub = org.subscriptions.reduce(
    (best, s) => ((planNames[s.plan] || 0) > (planNames[best?.plan || "FREE"] || 0) ? s : best),
    org.subscriptions[0]
  );

  return {
    plan: bestSub ? `${bestSub.app === "ATRIUM" ? "Atrium" : "WorkPipe"} ${bestSub.plan.charAt(0) + bestSub.plan.slice(1).toLowerCase()}` : "Free",
    teamCount: org.members.length,
    activeApps: Object.values(appStatuses).filter(Boolean).length,
    appStatuses,
  };
}

export default async function DashboardPage() {
  const user = await currentUser();
  const { userId } = await auth();

  const { plan, teamCount, activeApps, appStatuses } = userId
    ? await getDashboardData(userId)
    : { plan: "Free", teamCount: 1, activeApps: 0, appStatuses: {} };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">
          Welcome back{user?.firstName ? `, ${user.firstName}` : ""}
        </h1>
        <p className="text-gray-400 mt-1">
          Manage your Orbit products and team from one place.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass p-5">
          <p className="text-sm text-gray-400">Current Plan</p>
          <p className="text-xl font-semibold mt-1">{plan}</p>
        </div>
        <div className="glass p-5">
          <p className="text-sm text-gray-400">Team Members</p>
          <p className="text-xl font-semibold mt-1">{teamCount}</p>
        </div>
        <div className="glass p-5">
          <p className="text-sm text-gray-400">Active Apps</p>
          <p className="text-xl font-semibold mt-1">{activeApps}</p>
        </div>
      </div>

      {/* Apps */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Your Apps</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AppCard
            name="WorkPipe CRM"
            slug="workpipe"
            description="Pipelines, contacts, invoices, and automations. Everything you need to run your business."
            icon={
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            }
            color="#2B2FFF"
            status={appStatuses["WORKPIPE"] ? "active" : "inactive"}
          />
          <AppCard
            name="Orbit Drive"
            slug="drive"
            description="Banking-grade encrypted file storage for your organization. Upload, share, and manage files securely."
            icon={
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.338-2.338 4.502 4.502 0 013.516 5.855A4.5 4.5 0 0117.25 19.5H6.75z" />
              </svg>
            }
            color="#6961ff"
            status={appStatuses["DRIVE"] ? "active" : "inactive"}
          />
          <AppCard
            name="Atrium"
            slug="atrium"
            description="AI department heads for sales, support, and operations. Fortune 500 leverage for small teams."
            icon={
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            }
            color="#20B2AA"
            status={appStatuses["ATRIUM"] ? "active" : "inactive"}
          />
        </div>
      </div>
    </div>
  );
}
