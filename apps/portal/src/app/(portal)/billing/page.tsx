"use client";

import { SubscriptionCard } from "@/components/portal/subscription-card";

const plans = [
  {
    name: "Free",
    price: 0,
    features: [
      "1 team member",
      "Basic CRM (WorkPipe)",
      "100 contacts",
      "Community support",
    ],
    current: true,
  },
  {
    name: "Starter",
    price: 0,
    features: [
      "5 team members",
      "Full CRM (WorkPipe)",
      "1,000 contacts",
      "Email support",
      "Basic automations",
    ],
  },
  {
    name: "Pro",
    price: 0,
    features: [
      "25 team members",
      "Full CRM (WorkPipe)",
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
    price: 0,
    features: [
      "Unlimited team members",
      "Full CRM (WorkPipe)",
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
          {plans.map((plan) => (
            <SubscriptionCard
              key={plan.name}
              name={plan.name}
              price={plan.price}
              features={plan.features}
              highlighted={plan.highlighted}
              current={plan.current}
              onSelect={() => {
                // TODO: Stripe checkout session
                console.log(`Selected plan: ${plan.name}`);
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
