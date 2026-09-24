import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { AppLanding } from "@/components/portal/app-landing";
import { ACTIVE_SUBSCRIPTION_STATUSES, conductorActive } from "@/lib/entitlements";
import { isOrgLicensed } from "@/lib/license";

async function getConductorStatus(userId: string): Promise<{
  status: "bundled" | "coming_online";
  launchEnabled: boolean;
  launchUrl?: string;
}> {
  const cookieStore = await cookies();
  const selectedWorkspaceId = cookieStore.get("orbit_workspace")?.value;

  const include = {
    appAccess: true,
    subscriptions: { where: { status: { in: [...ACTIVE_SUBSCRIPTION_STATUSES] } } },
  };

  let member;
  if (selectedWorkspaceId) {
    member = await db.member.findFirst({
      where: { clerkUserId: userId, orgId: selectedWorkspaceId },
      include: { org: { include } },
    });
  }
  if (!member) {
    member = await db.member.findFirst({
      where: { clerkUserId: userId },
      include: { org: { include } },
    });
  }

  if (!member?.org) {
    return { status: "coming_online", launchEnabled: false };
  }

  const org = member.org;
  // Thread the license through so this page agrees with the JWT, which grants
  // CONDUCTOR to every licensed org (new orgs have no subscriptions at all).
  const active = conductorActive(org, isOrgLicensed(org));

  if (!active) {
    return { status: "coming_online", launchEnabled: false };
  }

  // Launch is entitlement-driven (atrium#58): an entitled org can launch — no env allowlist.
  return {
    status: "bundled",
    launchEnabled: true,
    launchUrl: process.env.NEXT_PUBLIC_CONDUCTOR_URL,
  };
}

const features = [
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-5.13a4 4 0 11-8 0 4 4 0 018 0zm6 0a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
    title: "Hire specialized AI team members",
    description: "Activate AI roles tailored to your business with human approval at every step.",
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    ),
    title: "Cross-functional delegation",
    description: "Conductor routes work across roles automatically so no task falls between seats.",
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19a3 3 0 11-6 0 3 3 0 016 0zm12-3a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    title: "Status, blockers, outcomes — one place",
    description: "Track execution across every AI team member with a single live view of what's done, stuck, and shipping.",
  },
];

export default async function ConductorPage() {
  const { userId } = await auth();
  const { status, launchEnabled, launchUrl } = userId
    ? await getConductorStatus(userId)
    : { status: "coming_online" as const, launchEnabled: false, launchUrl: undefined };

  return (
    <AppLanding
      name="Conductor"
      tagline="Your AI back office"
      description="Conductor plans, delegates, and executes work across your business while you stay in control."
      color="#A78BFA"
      icon={
        <svg className="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 2a3 3 0 00-3 3v1.17a3.001 3.001 0 00-1.83 1.83H6a3 3 0 000 6h.17a3.001 3.001 0 001.83 1.83V17a3 3 0 006 0v-1.17a3.001 3.001 0 001.83-1.83H18a3 3 0 000-6h-.17A3.001 3.001 0 0016 6.17V5a3 3 0 00-3-3z" />
        </svg>
      }
      status={status}
      launchUrl={launchUrl}
      launchEnabled={launchEnabled}
      callbackPath="/conductor/auth/callback"
      features={features}
      bundledNote="Conductor ships alongside Atrium — no separate setup needed."
    />
  );
}
