import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { AppLanding } from "@/components/portal/app-landing";

async function getAtriumStatus(userId: string): Promise<{
  status: "active" | "inactive" | "coming_soon";
  launchUrl?: string;
}> {
  const member = await db.member.findFirst({
    where: { clerkUserId: userId },
    include: {
      org: {
        include: {
          appAccess: { where: { app: "ATRIUM" } },
          subscriptions: { where: { app: "ATRIUM" } },
        },
      },
    },
  });

  if (!member?.org) return { status: "inactive" };

  // Platform admins (OWNER/ADMIN) get access to all apps regardless of subscription
  const isPlatformAdmin = member.role === "OWNER" || member.role === "ADMIN";

  const hasAccess = member.org.appAccess.some((a) => a.enabled);
  const hasSub = member.org.subscriptions.some(
    (s) => s.status === "ACTIVE" || s.status === "TRIALING"
  );

  if (isPlatformAdmin || (hasAccess && hasSub)) {
    return {
      status: "active",
      launchUrl: process.env.NEXT_PUBLIC_ATRIUM_URL || "https://atrium.orbit.example",
    };
  }

  return { status: "inactive" };
}

const features = [
  {
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
    title: "AI Department Heads",
    description: "Sales, Marketing, Customer Support, Finance, HR, Operations, Engineering, and Content — each with domain expertise and scoped knowledge.",
  },
  {
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>,
    title: "Voice Mode",
    description: "Talk to your AI department heads naturally. Real-time speech-to-text and text-to-speech for hands-free management.",
  },
  {
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
    title: "Delegated Mode",
    description: "AI proposes actions, you approve. Full control over what gets executed — no surprises, complete audit trail.",
  },
  {
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>,
    title: "Knowledge Bases",
    description: "Each department has its own scoped knowledge base with RAG retrieval. Upload docs, SOPs, and training materials.",
  },
  {
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>,
    title: "Cross-Department Reasoning",
    description: "Departments communicate directly and escalate to the Chief AI Agent. Complex decisions get multi-perspective analysis.",
  },
  {
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
    title: "WorkPipe CRM Included",
    description: "Every Atrium plan includes full WorkPipe CRM access. Your AI departments execute through the CRM automatically.",
  },
];

const plans = [
  {
    name: "Starter",
    description: "Try AI-powered departments for your business.",
    price: 0,
    app: "ATRIUM",
    plan: "STARTER",
    features: [
      "1 user",
      "3 AI department heads",
      "— AI interactions/mo",
      "Voice mode (limited)",
      "WorkPipe CRM included",
      "Delegated mode",
      "Knowledge base",
      "Orbit Drive (5 GB)",
    ],
  },
  {
    name: "Growth",
    description: "Full AI organization for teams ready to scale.",
    price: 0,
    app: "ATRIUM",
    plan: "GROWTH",
    features: [
      "5 users",
      "All 8 AI department heads",
      "— AI interactions/mo",
      "Full voice mode",
      "WorkPipe CRM included",
      "Priority model routing",
      "Cross-dept reasoning",
      "Advanced RAG",
      "Orbit Drive (50 GB)",
    ],
    highlighted: true,
  },
  {
    name: "Enterprise",
    description: "Dedicated AI infrastructure with white-label options.",
    price: 0,
    app: "ATRIUM",
    plan: "ENTERPRISE",
    features: [
      "Unlimited users",
      "All dept heads + custom",
      "Unlimited AI interactions",
      "Full voice mode",
      "WorkPipe CRM included",
      "Dedicated infrastructure",
      "SSO & SLA guarantee",
      "White-label option",
      "Custom integrations",
      "Orbit Drive (unlimited)",
    ],
  },
];

export default async function AtriumPage() {
  const { userId } = await auth();
  const { status, launchUrl } = userId
    ? await getAtriumStatus(userId)
    : { status: "inactive" as const, launchUrl: undefined };

  return (
    <AppLanding
      name="Atrium"
      tagline="Fortune 500 leverage. Small team price."
      description="An AI-powered organizational operating system that gives your business dedicated department heads for sales, support, operations, and more — all working 24/7."
      color="#20B2AA"
      icon={
        <svg className="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      }
      status={status}
      launchUrl={launchUrl}
      features={features}
      plans={plans}
    />
  );
}
