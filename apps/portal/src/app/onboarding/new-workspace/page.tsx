"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import LogoUpload from "@/components/onboarding/logo-upload";

type Step = 1 | 2 | 3 | 4;

interface ProductSelection {
  app: "WORKPIPE" | "ATRIUM";
  plan: string;
}

const industries = [
  "Marketing & Advertising",
  "Technology & Software",
  "Consulting & Professional Services",
  "Real Estate",
  "Healthcare",
  "E-commerce & Retail",
  "Financial Services",
  "Education",
  "Manufacturing",
  "Other",
];

const workpipePlans = [
  {
    id: "STARTER",
    name: "Starter",
    price: 0,
    description: "For solo operators getting started",
    features: ["1 user", "500 contacts", "Basic automations"],
  },
  {
    id: "PRO",
    name: "Pro",
    price: 0,
    description: "For growing teams",
    features: ["5 users", "5,000 contacts", "Full automations", "API access"],
    recommended: true,
  },
  {
    id: "BUSINESS",
    name: "Business",
    price: 0,
    description: "For companies that need scale",
    features: ["25 users", "Unlimited contacts", "Priority support"],
  },
];

const atriumPlans = [
  {
    id: "STARTER",
    name: "Starter",
    price: 0,
    description: "Try AI-powered departments",
    features: ["1 user", "3 AI department heads", "— AI interactions/mo"],
  },
  {
    id: "GROWTH",
    name: "Growth",
    price: 0,
    description: "Full AI organization",
    features: ["5 users", "All 8 AI department heads", "— AI interactions/mo"],
    recommended: true,
  },
  {
    id: "ENTERPRISE",
    name: "Enterprise",
    price: 0,
    description: "Dedicated AI infrastructure",
    features: ["Unlimited users", "Unlimited AI interactions", "SSO & SLA"],
  },
];

export default function NewWorkspaceWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1
  const [workspaceName, setWorkspaceName] = useState("");
  const [industry, setIndustry] = useState("");
  const [logoUrl, setLogoUrl] = useState("");

  // Step 2
  const [selectedProducts, setSelectedProducts] = useState<ProductSelection[]>([]);

  const toggleProduct = (app: "WORKPIPE" | "ATRIUM", plan: string) => {
    setSelectedProducts((prev) => {
      const existing = prev.find((p) => p.app === app);
      if (existing) {
        if (existing.plan === plan) {
          // Deselect
          return prev.filter((p) => p.app !== app);
        } else {
          // Change plan
          return prev.map((p) => (p.app === app ? { ...p, plan } : p));
        }
      } else {
        // Select new
        return [...prev, { app, plan }];
      }
    });
  };

  const isSelected = (app: "WORKPIPE" | "ATRIUM", plan: string) => {
    return selectedProducts.some((p) => p.app === app && p.plan === plan);
  };

  const hasProduct = (app: "WORKPIPE" | "ATRIUM") => {
    return selectedProducts.some((p) => p.app === app);
  };

  // Step 3 — optional sub-accounts (sub-workspaces under this org)
  const [subAccounts, setSubAccounts] = useState<string[]>([]);

  const addSubAccount = () => setSubAccounts((prev) => [...prev, ""]);
  const updateSubAccount = (index: number, value: string) =>
    setSubAccounts((prev) => prev.map((s, i) => (i === index ? value : s)));
  const removeSubAccount = (index: number) =>
    setSubAccounts((prev) => prev.filter((_, i) => i !== index));

  // Non-empty, de-duped sub-account names (case-insensitive) for submit + review.
  const cleanedSubAccounts = (() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of subAccounts) {
      const name = raw.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(name);
    }
    return out;
  })();

  const handleNext = () => {
    if (step === 1) {
      if (!workspaceName.trim()) {
        setError("Please enter a workspace name");
        return;
      }
      setError(null);
      setStep(2);
    } else if (step === 2) {
      if (selectedProducts.length === 0) {
        setError("Please select at least one product");
        return;
      }
      setError(null);
      setStep(3);
    } else if (step === 3) {
      // Sub-accounts are optional — no validation, just advance to review.
      setError(null);
      setStep(4);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((step - 1) as Step);
    }
  };

  const handleCreate = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/workspaces/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: workspaceName.trim(),
          industry: industry || undefined,
          logoUrl: logoUrl || undefined,
          products: selectedProducts,
          subAccounts: cleanedSubAccounts.map((name) => ({ name })),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create workspace");
        setLoading(false);
        return;
      }

      // Redirect to dashboard with new workspace
      router.push("/dashboard?new=true");
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex">
      {/* Left side - Form */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-white/10">
          <a href="/dashboard" className="text-gray-400 hover:text-white text-sm flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Dashboard
          </a>
        </div>

        {/* Content */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-lg">
            {/* Progress */}
            <div className="flex items-center gap-2 mb-8">
              {[1, 2, 3, 4].map((s) => (
                <div key={s} className="flex items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      s === step
                        ? "bg-[#2B2FFF] text-white"
                        : s < step
                        ? "bg-green-500 text-white"
                        : "bg-white/10 text-gray-500"
                    }`}
                  >
                    {s < step ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      s
                    )}
                  </div>
                  {s < 4 && <div className={`w-12 h-0.5 ${s < step ? "bg-green-500" : "bg-white/10"}`} />}
                </div>
              ))}
            </div>

            {/* Step 1: Workspace Info */}
            {step === 1 && (
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl font-bold text-white mb-2">Create your workspace</h1>
                  <p className="text-gray-400">
                    Set up a new workspace for your team or organization.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Workspace name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={workspaceName}
                      onChange={(e) => setWorkspaceName(e.target.value)}
                      placeholder="My Company"
                      className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#2B2FFF] focus:border-transparent"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Industry (optional)
                    </label>
                    <select
                      value={industry}
                      onChange={(e) => setIndustry(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-[#2B2FFF] focus:border-transparent"
                    >
                      <option value="">Select an industry</option>
                      {industries.map((ind) => (
                        <option key={ind} value={ind}>
                          {ind}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Workspace logo (optional)
                    </label>
                    <LogoUpload value={logoUrl} onChange={(url) => setLogoUrl(url ?? "")} />
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Product Selection */}
            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl font-bold text-white mb-2">Choose your products</h1>
                  <p className="text-gray-400">
                    Select the products you want to try. You&apos;ll get a 7-day free trial.
                  </p>
                </div>

                {/* WorkPipe CRM */}
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-[#2B2FFF]/20 flex items-center justify-center">
                      <svg className="w-4 h-4 text-[#2B2FFF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">WorkPipe CRM</h3>
                      <p className="text-xs text-gray-400">Full-featured CRM for small businesses</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {workpipePlans.map((plan) => (
                      <button
                        key={plan.id}
                        onClick={() => toggleProduct("WORKPIPE", plan.id)}
                        className={`relative p-3 rounded-lg border text-left transition-all ${
                          isSelected("WORKPIPE", plan.id)
                            ? "border-[#2B2FFF] bg-[#2B2FFF]/10"
                            : hasProduct("WORKPIPE")
                            ? "border-white/5 bg-white/2 opacity-50"
                            : "border-white/10 bg-white/5 hover:border-white/20"
                        }`}
                      >
                        {plan.recommended && (
                          <span className="absolute -top-2 right-2 px-2 py-0.5 bg-[#2B2FFF] text-white text-[10px] font-bold rounded-full">
                            POPULAR
                          </span>
                        )}
                        <p className="font-medium text-white text-sm">{plan.name}</p>
                        <p className="text-lg font-bold text-white">${plan.price}<span className="text-xs text-gray-400">/mo</span></p>
                        <p className="text-[10px] text-gray-500 mt-1">{plan.features[0]}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Atrium */}
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-[#20B2AA]/20 flex items-center justify-center">
                      <svg className="w-4 h-4 text-[#20B2AA]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">Atrium</h3>
                      <p className="text-xs text-gray-400">AI-powered department heads for your business</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {atriumPlans.map((plan) => (
                      <button
                        key={plan.id}
                        onClick={() => toggleProduct("ATRIUM", plan.id)}
                        className={`relative p-3 rounded-lg border text-left transition-all ${
                          isSelected("ATRIUM", plan.id)
                            ? "border-[#20B2AA] bg-[#20B2AA]/10"
                            : hasProduct("ATRIUM")
                            ? "border-white/5 bg-white/2 opacity-50"
                            : "border-white/10 bg-white/5 hover:border-white/20"
                        }`}
                      >
                        {plan.recommended && (
                          <span className="absolute -top-2 right-2 px-2 py-0.5 bg-[#20B2AA] text-white text-[10px] font-bold rounded-full">
                            POPULAR
                          </span>
                        )}
                        <p className="font-medium text-white text-sm">{plan.name}</p>
                        <p className="text-lg font-bold text-white">${plan.price}<span className="text-xs text-gray-400">/mo</span></p>
                        <p className="text-[10px] text-gray-500 mt-1">{plan.features[0]}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Orbit Drive note */}
                <div className="flex items-center gap-3 p-3 rounded-lg bg-[#6961ff]/10 border border-[#6961ff]/20">
                  <svg className="w-5 h-5 text-[#6961ff]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="text-sm text-gray-300">
                    <span className="font-medium text-white">Orbit Drive</span> is included free with any subscription.
                  </p>
                </div>
              </div>
            )}

            {/* Step 3: Sub-accounts (optional) */}
            {step === 3 && (
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl font-bold text-white mb-2">Add sub-accounts</h1>
                  <p className="text-gray-400">
                    Optionally split this workspace into sub-accounts — separate spaces for
                    clients, locations, or brands. You can always add more later.
                  </p>
                </div>

                <div className="space-y-3">
                  {subAccounts.length === 0 && (
                    <p className="text-sm text-gray-500">
                      No sub-accounts yet. Skip this step to start at the workspace level.
                    </p>
                  )}

                  {subAccounts.map((value, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={value}
                        onChange={(e) => updateSubAccount(index, e.target.value)}
                        placeholder={`Sub-account ${index + 1} name`}
                        className="flex-1 px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#2B2FFF] focus:border-transparent"
                      />
                      <button
                        type="button"
                        onClick={() => removeSubAccount(index)}
                        className="p-2 text-gray-400 hover:text-red-400 hover:bg-white/5 rounded-lg"
                        aria-label="Remove sub-account"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={addSubAccount}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-white/20 text-gray-300 hover:border-[#2B2FFF] hover:text-white transition-colors text-sm"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add sub-account
                  </button>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-[#6961ff]/10 border border-[#6961ff]/20">
                  <svg className="w-5 h-5 text-[#6961ff] mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-gray-300">
                    Sub-accounts keep each client&apos;s data, files, and AI memory separate within
                    the same workspace. Optional — leave empty to operate at the workspace level.
                  </p>
                </div>
              </div>
            )}

            {/* Step 4: Review */}
            {step === 4 && (
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl font-bold text-white mb-2">Start your free trial</h1>
                  <p className="text-gray-400">
                    Review your selections and start your 7-day free trial. No credit card required.
                  </p>
                </div>

                <div className="bg-white/5 rounded-xl border border-white/10 divide-y divide-white/10">
                  {/* Workspace */}
                  <div className="p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[#2B2FFF]/20 flex items-center justify-center text-[#2B2FFF] font-bold">
                      {workspaceName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-white">{workspaceName}</p>
                      <p className="text-sm text-gray-400">{industry || "Workspace"}</p>
                    </div>
                    <svg className="w-5 h-5 text-green-500 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>

                  {/* Selected Products */}
                  {selectedProducts.map((product) => {
                    const plans = product.app === "WORKPIPE" ? workpipePlans : atriumPlans;
                    const plan = plans.find((p) => p.id === product.plan);
                    return (
                      <div key={product.app} className="p-4 flex items-center gap-4">
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            product.app === "WORKPIPE" ? "bg-[#2B2FFF]/20" : "bg-[#20B2AA]/20"
                          }`}
                        >
                          {product.app === "WORKPIPE" ? (
                            <svg className="w-5 h-5 text-[#2B2FFF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5 text-[#20B2AA]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-white">
                            {product.app === "WORKPIPE" ? "WorkPipe CRM" : "Atrium"} - {plan?.name}
                          </p>
                          <p className="text-sm text-gray-400">${plan?.price}/mo after trial</p>
                        </div>
                        <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    );
                  })}

                  {/* Orbit Drive */}
                  <div className="p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[#6961ff]/20 flex items-center justify-center">
                      <svg className="w-5 h-5 text-[#6961ff]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-white">Orbit Drive</p>
                      <p className="text-sm text-gray-400">Included free</p>
                    </div>
                    <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>

                  {/* Sub-accounts */}
                  {cleanedSubAccounts.length > 0 && (
                    <div className="p-4 flex items-start gap-4">
                      <div className="w-10 h-10 rounded-lg bg-[#2B2FFF]/20 flex items-center justify-center text-[#2B2FFF] font-bold">
                        {cleanedSubAccounts.length}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-white">
                          {cleanedSubAccounts.length} sub-account{cleanedSubAccounts.length > 1 ? "s" : ""}
                        </p>
                        <p className="text-sm text-gray-400">{cleanedSubAccounts.join(", ")}</p>
                      </div>
                      <svg className="w-5 h-5 text-green-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Trial info */}
                <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-green-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="font-medium text-white">7-day free trial</p>
                      <p className="text-sm text-gray-400">
                        No credit card required. You&apos;ll be reminded before your trial ends.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between mt-8">
              <button
                onClick={handleBack}
                disabled={step === 1}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  step === 1
                    ? "text-gray-600 cursor-not-allowed"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                Back
              </button>

              {step < 4 ? (
                <button
                  onClick={handleNext}
                  className="px-6 py-2.5 rounded-lg bg-[#2B2FFF] text-white font-medium hover:bg-[#2B2FFF]/90 transition-colors"
                >
                  Continue
                </button>
              ) : (
                <button
                  onClick={handleCreate}
                  disabled={loading}
                  className="px-6 py-2.5 rounded-lg bg-[#2B2FFF] text-white font-medium hover:bg-[#2B2FFF]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Start Free Trial"
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Graphic (hidden on mobile) */}
      <div className="hidden lg:flex w-1/3 bg-gradient-to-br from-[#2B2FFF]/20 to-[#20B2AA]/20 items-center justify-center p-12">
        <div className="text-center">
          <div className="w-24 h-24 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-6">
            <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Build Your Business</h2>
          <p className="text-gray-400 text-sm">
            Get started with powerful tools for CRM, AI automation, and secure file storage.
          </p>
        </div>
      </div>
    </div>
  );
}
