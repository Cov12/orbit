"use client";

import { useEffect, useState } from "react";
import { SubscriptionCard } from "@/components/portal/subscription-card";

type Interval = "monthly" | "annual";

interface CurrentWorkspace {
  id: string;
  name: string;
  role: string;
}

const workpipePlans = [
  {
    name: "Starter",
    description: "For solo operators getting started with CRM.",
    price: 0,
    annualPrice: 0,
    app: "WORKPIPE",
    plan: "STARTER",
    features: [
      "1 user",
      "500 contacts",
      "Pipelines & deals",
      "Basic automations",
      "Invoicing",
      "Orbit Drive (1 GB)",
    ],
  },
  {
    name: "Pro",
    description: "For growing teams that need the full CRM toolkit.",
    price: 0,
    annualPrice: 0,
    app: "WORKPIPE",
    plan: "PRO",
    features: [
      "5 users",
      "5,000 contacts",
      "Full automations",
      "Reporting & analytics",
      "API access",
      "Orbit Drive (10 GB)",
    ],
    highlighted: true,
  },
  {
    name: "Business",
    description: "For companies that need scale and customization.",
    price: 0,
    annualPrice: 0,
    app: "WORKPIPE",
    plan: "BUSINESS",
    features: [
      "25 users",
      "Unlimited contacts",
      "Advanced reporting",
      "Custom fields",
      "Priority support",
      "Orbit Drive (50 GB)",
    ],
  },
];

const atriumPlans = [
  {
    name: "Starter",
    description: "Try AI-powered departments for your business.",
    price: 0,
    annualPrice: 0,
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
    annualPrice: 0,
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
    annualPrice: 0,
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

export default function BillingPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [interval, setInterval] = useState<Interval>("monthly");
  const [workspace, setWorkspace] = useState<CurrentWorkspace | null>(null);
  const [loadingWorkspace, setLoadingWorkspace] = useState(true);
  const [licensed, setLicensed] = useState(false);

  // Fetch current workspace to check role + license state
  useEffect(() => {
    fetch("/api/workspaces")
      .then((r) => r.json())
      .then((data) => {
        setWorkspace(data.current || null);
        setLicensed(!!data.licensed);
        setLoadingWorkspace(false);
      })
      .catch(() => setLoadingWorkspace(false));
  }, []);

  // Only OWNER and ADMIN can access billing
  const canAccessBilling = workspace?.role === "OWNER" || workspace?.role === "ADMIN";

  async function handleSelect(app: string, plan: string) {
    const key = `${app}-${plan}`;
    setLoading(key);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ app, plan, interval }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      // noop
    } finally {
      setLoading(null);
    }
  }

  if (loadingWorkspace) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-[#2B2FFF] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  // License mode: no Stripe subscriptions to manage — show a licensed state
  // instead of the plans, for every role.
  if (licensed) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="bg-[#1a1a1f] rounded-xl border border-white/10 p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-[#20B2AA]/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-[#20B2AA]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Licensed</h1>
          <p className="text-gray-400 mb-2">
            <span className="text-white font-medium">{workspace?.name || "This workspace"}</span> is fully licensed — every app is included, with no subscription required.
          </p>
          <p className="text-gray-500 text-sm">
            There&apos;s nothing to manage here. Reach out to your administrator with any questions about your license.
          </p>
        </div>
      </div>
    );
  }

  if (!canAccessBilling) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="bg-[#1a1a1f] rounded-xl border border-white/10 p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-[#2B2FFF]/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-[#2B2FFF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Billing Access Restricted</h1>
          <p className="text-gray-400 mb-2">
            Only workspace owners and admins can manage billing and subscriptions.
          </p>
          <p className="text-gray-500 text-sm">
            You&apos;re currently a <span className="text-white font-medium capitalize">{workspace?.role?.toLowerCase()}</span> in{" "}
            <span className="text-white font-medium">{workspace?.name}</span>.
          </p>
          <p className="text-gray-500 text-sm mt-4">
            Contact your workspace owner if you need to upgrade your plan.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-12">
      <div>
        <h1 className="text-2xl font-bold">Billing</h1>
        <p className="text-gray-400 mt-1">
          Manage billing for <span className="text-white font-medium">{workspace?.name}</span>. Orbit Drive is included free with any plan.
        </p>
      </div>

      {/* Monthly / Annual Toggle */}
      <div className="flex items-center justify-center gap-3">
        <span className={`text-sm font-medium ${interval === "monthly" ? "text-white" : "text-gray-500"}`}>Monthly</span>
        <button
          onClick={() => setInterval(interval === "monthly" ? "annual" : "monthly")}
          className={`relative w-14 h-7 rounded-full transition-colors ${
            interval === "annual" ? "bg-[#20B2AA]" : "bg-white/20"
          }`}
          aria-label="Toggle billing interval"
        >
          <span
            className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white transition-transform ${
              interval === "annual" ? "translate-x-7" : ""
            }`}
          />
        </button>
        <span className={`text-sm font-medium ${interval === "annual" ? "text-white" : "text-gray-500"}`}>
          Annual
          <span className="ml-1.5 text-xs text-[#20B2AA] font-semibold">Save 15%</span>
        </span>
      </div>

      {/* WorkPipe CRM */}
      <section>
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-[#2B2FFF]/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-[#2B2FFF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-semibold">WorkPipe CRM</h2>
              <p className="text-sm text-gray-400">Full-featured CRM built for small businesses.</p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {workpipePlans.map((p) => (
            <SubscriptionCard
              key={`wp-${p.plan}`}
              name={p.name}
              description={p.description}
              price={p.price}
              features={p.features}
              highlighted={p.highlighted}
              annualPrice={p.annualPrice}
              interval={interval}
              loading={loading === `${p.app}-${p.plan}`}
              onSelect={() => handleSelect(p.app, p.plan)}
            />
          ))}
        </div>
      </section>

      {/* Atrium */}
      <section>
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-[#20B2AA]/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-[#20B2AA]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-semibold">Atrium</h2>
              <p className="text-sm text-gray-400">AI-powered department heads. Fortune 500 leverage for small teams.</p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {atriumPlans.map((p) => (
            <SubscriptionCard
              key={`aos-${p.plan}`}
              name={p.name}
              description={p.description}
              price={p.price}
              features={p.features}
              highlighted={p.highlighted}
              annualPrice={p.annualPrice}
              interval={interval}
              loading={loading === `${p.app}-${p.plan}`}
              onSelect={() => handleSelect(p.app, p.plan)}
            />
          ))}
        </div>
      </section>

      {/* Orbit Drive — Free */}
      <section>
        <div className="glass p-6 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-[#6961ff]/20 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-[#6961ff]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.338-2.338 4.502 4.502 0 013.516 5.855A4.5 4.5 0 0117.25 19.5H6.75z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-lg">Orbit Drive</h3>
            <p className="text-sm text-gray-400">
              Secure encrypted file storage — <span className="text-[#20B2AA] font-medium">free</span> with any subscription. Storage scales with your plan.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
