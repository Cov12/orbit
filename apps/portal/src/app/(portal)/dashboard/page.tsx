import { auth, currentUser } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { AppCard } from "@/components/portal/app-card";
import { conductorActive } from "@/lib/entitlements";

interface DashboardData {
  workspaceName: string;
  workspaceRole: string;
  plan: string;
  planStatus: "active" | "trialing" | "none";
  trialEndsAt: Date | null;
  teamCount: number;
  activeApps: number;
  appStatuses: Record<string, boolean>;
  conductorVisible: boolean;
}

async function getDashboardData(userId: string): Promise<DashboardData> {
  // Get the selected workspace from cookie
  const cookieStore = await cookies();
  const selectedWorkspaceId = cookieStore.get("orbit_workspace")?.value;

  // Find membership - either for selected workspace or first available
  let member;
  if (selectedWorkspaceId) {
    member = await db.member.findFirst({
      where: { clerkUserId: userId, orgId: selectedWorkspaceId },
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
  }

  // Fallback to first membership if selected workspace not found
  if (!member) {
    member = await db.member.findFirst({
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
  }

  if (!member?.org) {
    return {
      workspaceName: "No Workspace",
      workspaceRole: "none",
      plan: "Free",
      planStatus: "none",
      trialEndsAt: null,
      teamCount: 1,
      activeApps: 0,
      appStatuses: {},
      conductorVisible: false,
    };
  }

  const org = member.org;
  const conductorOn = conductorActive(org);
  const appStatuses: Record<string, boolean> = {};
  for (const access of org.appAccess) {
    if (access.app === "CONDUCTOR") {
      appStatuses[access.app] = conductorOn;
      continue;
    }
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

  // Check if any subscription is trialing
  const trialingSub = org.subscriptions.find((s) => s.status === "TRIALING");

  // Entitlement-driven (atrium#58): the Conductor card shows only when the org is entitled.
  const conductorVisible = conductorOn;

  return {
    workspaceName: org.name,
    workspaceRole: member.role,
    plan: bestSub
      ? `${bestSub.app === "ATRIUM" ? "Atrium" : bestSub.app === "DRIVE" ? "Drive" : "WorkPipe"} ${bestSub.plan.charAt(0) + bestSub.plan.slice(1).toLowerCase()}`
      : "Free",
    planStatus: trialingSub ? "trialing" : bestSub ? "active" : "none",
    trialEndsAt: trialingSub?.currentPeriodEnd || null,
    teamCount: org.members.length,
    activeApps: Object.values(appStatuses).filter(Boolean).length,
    appStatuses,
    conductorVisible,
  };
}

export default async function DashboardPage() {
  const user = await currentUser();
  const { userId } = await auth();

  const data = userId
    ? await getDashboardData(userId)
    : {
        workspaceName: "No Workspace",
        workspaceRole: "none",
        plan: "Free",
        planStatus: "none" as const,
        trialEndsAt: null,
        teamCount: 1,
        activeApps: 0,
        appStatuses: {},
        conductorVisible: false,
      };

  const { workspaceName, workspaceRole, plan, planStatus, trialEndsAt, teamCount, activeApps, appStatuses, conductorVisible } = data;

  // Calculate days remaining in trial
  const daysRemaining = trialEndsAt
    ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header with Workspace Context */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-[#2B2FFF]/20 flex items-center justify-center text-lg font-bold text-[#2B2FFF]">
            {workspaceName.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold">
              Welcome back{user?.firstName ? `, ${user.firstName}` : ""}
            </h1>
            <p className="text-gray-400 text-sm">
              <span className="text-white font-medium">{workspaceName}</span>
              <span className="mx-2">·</span>
              <span className="capitalize">{workspaceRole.toLowerCase()}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Trial Banner */}
      {planStatus === "trialing" && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-[#2B2FFF]/20 to-[#20B2AA]/20 border border-[#2B2FFF]/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#2B2FFF]/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-[#2B2FFF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-white">Free Trial Active</p>
                <p className="text-sm text-gray-400">
                  {daysRemaining} day{daysRemaining !== 1 ? "s" : ""} remaining · No credit card required
                </p>
              </div>
            </div>
            <a
              href="/billing"
              className="px-4 py-2 rounded-lg bg-[#2B2FFF] text-white text-sm font-medium hover:bg-[#2B2FFF]/90 transition-colors"
            >
              Upgrade Now
            </a>
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass p-5">
          <p className="text-sm text-gray-400">Current Plan</p>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-xl font-semibold">{plan}</p>
            {planStatus === "trialing" && (
              <span className="px-2 py-0.5 rounded-full bg-[#20B2AA]/20 text-[#20B2AA] text-xs font-medium">
                Trial
              </span>
            )}
          </div>
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
          {conductorVisible && (
            <AppCard
              name="Conductor"
              slug="conductor"
              description="AI back office that plans, delegates, and executes work across your business."
              icon={
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 2a3 3 0 00-3 3v1.17a3.001 3.001 0 00-1.83 1.83H6a3 3 0 000 6h.17a3.001 3.001 0 001.83 1.83V17a3 3 0 006 0v-1.17a3.001 3.001 0 001.83-1.83H18a3 3 0 000-6h-.17A3.001 3.001 0 0016 6.17V5a3 3 0 00-3-3z" />
                </svg>
              }
              color="#A78BFA"
              status={appStatuses["CONDUCTOR"] ? "bundled" : "coming_online"}
            />
          )}
        </div>
      </div>
    </div>
  );
}
