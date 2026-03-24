"use client";

import { useState } from "react";
import { SubscriptionCard } from "@/components/portal/subscription-card";

const plans = [
  {
    name: "Free",
    description: "Get started with the essentials. Perfect for solo founders exploring Orbit.",
    price: 0,
    plan: "FREE",
    features: [
      "1 team member",
      "WorkPipe CRM (basic)",
      "Orbit Drive (1 GB)",
      "100 contacts",
      "Community support",
    ],
  },
  {
    name: "Starter",
    description: "For growing teams ready to unlock the full power of WorkPipe.",
    price: 0,
    plan: "STARTER",
    features: [
      "5 team members",
      "WorkPipe CRM",
      "Orbit Drive (10 GB)",
      "1,000 contacts",
      "Email support",
      "Basic automations",
    ],
  },
  {
    name: "Pro",
    description: "AI-powered operations. Your team gets a Fortune 500 org structure on autopilot.",
    price: 0,
    plan: "PRO",
    features: [
      "25 team members",
      "WorkPipe CRM",
      "Orbit Drive (100 GB)",
      "Atrium (AI departments)",
      "Unlimited contacts",
      "Priority support",
      "Advanced automations",
      "Voice mode",
    ],
    highlighted: true,
  },
  {
    name: "Enterprise",
    description: "Full platform with white-label, custom integrations, and dedicated support.",
    price: 0,
    plan: "ENTERPRISE",
    features: [
      "Unlimited team members",
      "WorkPipe CRM",
      "Orbit Drive (unlimited)",
      "Atrium (AI departments)",
      "Unlimited contacts",
      "Dedicated support",
      "Custom integrations",
      "Voice mode",
      "White-label option",
      "SLA guarantee",
    ],
  },
];

export default function BillingPage() {
  const [loading, setLoading] = useState<string | null>(null);

  async function handleSelect(plan: string) {
    if (plan === "FREE") return;
    setLoading(plan);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
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

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Billing</h1>
        <p className="text-gray-400 mt-1">
          Manage your subscription and payment methods.
        </p>
      </div>

      {/* Current Plan */}
      <div className="glass p-6 flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-400">Current Plan</p>
          <p className="text-xl font-semibold mt-1">Free</p>
          <p className="text-sm text-gray-500 mt-0.5">1 team member · 100 contacts</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-400">Next billing date</p>
          <p className="text-sm font-medium mt-1">—</p>
        </div>
      </div>

      {/* Plan Comparison */}
      <div>
        <h2 className="text-lg font-semibold mb-6">Choose a Plan</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((p) => (
            <SubscriptionCard
              key={p.name}
              name={p.name}
              description={p.description}
              price={p.price}
              features={p.features}
              highlighted={p.highlighted}
              current={p.plan === "FREE"}
              loading={loading === p.plan}
              onSelect={() => handleSelect(p.plan)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
