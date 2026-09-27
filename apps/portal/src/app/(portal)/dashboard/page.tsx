import { auth, currentUser } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { AppCard } from "@/components/portal/app-card";
import { ACTIVE_SUBSCRIPTION_STATUSES, getAppEntitlementMap } from "@/lib/entitlements";
import { isOrgLicensed } from "@/lib/license";

interface DashboardData {
  workspaceName: string;
  workspaceRole: string;
  licensed: boolean;
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
            subscriptions: { where: { status: { in: [...ACTIVE_SUBSCRIPTION_STATUSES] } } },
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
            subscriptions: { where: { status: { in: [...ACTIVE_SUBSCRIPTION_STATUSES] } } },
          },
        },
      },
    });
  }

  if (!member?.org) {
    return {
      workspaceName: "No Workspace",
      workspaceRole: "none",
      licensed: false,
      teamCount: 1,
      activeApps: 0,
      appStatuses: {},
      conductorVisible: false,
    };
  }

  const org = member.org;
  const isPlatformAdmin = member.role === "OWNER" || member.role === "ADMIN";
  const licensed = isOrgLicensed(org);
  // Per-app status from the single unified selector — identical to what the JWT
  // grants (getEffectiveAppAccess). `licensed` must be threaded so the display
  // matches the token under license mode (on by default in this edition).
  const appStatuses = getAppEntitlementMap(org, isPlatformAdmin, licensed);

  return {
    workspaceName: org.name,
    workspaceRole: member.role,
    licensed,
    teamCount: org.members.length,
    activeApps: Object.values(appStatuses).filter(Boolean).length,
    appStatuses,
    // Entitlement-driven (atrium#58): the Conductor card shows only when the org is entitled.
    conductorVisible: appStatuses.CONDUCTOR,
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
        licensed: false,
        teamCount: 1,
        activeApps: 0,
        appStatuses: {},
        conductorVisible: false,
      };

  const { workspaceName, workspaceRole, licensed, teamCount, activeApps, appStatuses, conductorVisible } = data;

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

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass p-5">
          <p className="text-sm text-gray-400">License</p>
          {licensed ? (
            <p className="text-xl font-semibold mt-1">
              Licensed <span className="text-sm font-normal text-gray-400">— all apps included</span>
            </p>
          ) : (
            <p className="text-xl font-semibold mt-1 text-gray-400">Not licensed</p>
          )}
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
            description="Private file storage for your organization. Upload, share, and manage files securely."
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
