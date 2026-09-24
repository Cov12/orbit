"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import LogoUpload from "@/components/onboarding/logo-upload";

type Step = 1 | 2 | 3;

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

// Every app is included with the license; shown on the review step so the
// owner knows what the new workspace gets.
const includedApps = [
  { name: "WorkPipe CRM", description: "Pipelines, contacts, invoices, and automations", color: "#2B2FFF" },
  { name: "Atrium", description: "AI-powered department heads for your business", color: "#20B2AA" },
  { name: "Conductor", description: "AI back office that plans and delegates work", color: "#A78BFA" },
  { name: "Orbit Drive", description: "Encrypted file storage for your workspace", color: "#6961ff" },
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

  // Step 2 — optional sub-accounts (sub-workspaces under this org)
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
      // Sub-accounts are optional — no validation, just advance to review.
      setError(null);
      setStep(3);
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
              {[1, 2, 3].map((s) => (
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
                  {s < 3 && <div className={`w-12 h-0.5 ${s < step ? "bg-green-500" : "bg-white/10"}`} />}
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
                      className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-[#2B2FFF] focus:border-transparent [color-scheme:dark]"
                    >
                      <option value="" className="bg-[#1c1c21] text-white">
                        Select an industry
                      </option>
                      {industries.map((ind) => (
                        <option key={ind} value={ind} className="bg-[#1c1c21] text-white">
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

            {/* Step 2: Sub-accounts (optional) */}
            {step === 2 && (
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

            {/* Step 3: Review */}
            {step === 3 && (
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl font-bold text-white mb-2">Review your workspace</h1>
                  <p className="text-gray-400">
                    Confirm the details below. Your license includes every Orbit app.
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

                  {/* Included apps */}
                  {includedApps.map((app) => (
                    <div key={app.name} className="p-4 flex items-center gap-4">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center font-bold"
                        style={{ backgroundColor: `${app.color}33`, color: app.color }}
                      >
                        {app.name.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-white">{app.name}</p>
                        <p className="text-sm text-gray-400">{app.description}</p>
                      </div>
                      <span className="text-xs text-green-400">Included</span>
                    </div>
                  ))}

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

                {/* License info */}
                <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-green-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="font-medium text-white">Licensed — all apps included</p>
                      <p className="text-sm text-gray-400">
                        Everyone you invite to this workspace can launch every app.
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

              {step < 3 ? (
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
                    "Create Workspace"
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
