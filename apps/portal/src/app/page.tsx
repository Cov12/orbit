import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function LandingPage() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");

  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center font-bold text-sm">
            W
          </div>
          <span className="font-semibold text-lg">Orbit</span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/sign-in"
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="text-sm px-4 py-2 rounded-lg gradient-primary hover:opacity-90 transition-opacity"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="max-w-3xl mx-auto space-y-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-sm text-gray-400">
            <span className="w-2 h-2 rounded-full bg-[#20B2AA] animate-pulse" />
            Platforms Built to Grow With You
          </div>

          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight">
            One login.{" "}
            <span className="bg-clip-text text-transparent gradient-primary">
              All of Orbit.
            </span>
          </h1>

          <p className="text-xl text-gray-400 max-w-xl mx-auto">
            Access WorkPipe CRM, Atrium AI departments, and every Orbit
            product from a single portal. Manage your team, workspaces, and
            apps in one place.
          </p>

          <div className="flex items-center justify-center gap-4">
            <Link
              href="/sign-up"
              className="px-6 py-3 rounded-lg gradient-primary font-medium hover:opacity-90 transition-opacity"
            >
              Get Started
            </Link>
            <Link
              href="#features"
              className="px-6 py-3 rounded-lg glass-hover font-medium"
            >
              Learn More
            </Link>
          </div>
        </div>

        {/* App Cards Preview */}
        <div className="mt-20 grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto w-full" id="features">
          <div className="glass p-6 text-left space-y-3">
            <div className="w-10 h-10 rounded-lg bg-[#2B2FFF]/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-[#2B2FFF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h3 className="font-semibold text-lg">WorkPipe CRM</h3>
            <p className="text-sm text-gray-400">
              Full-featured CRM with pipelines, contacts, invoices, and automations.
              Built for small businesses that want to compete with the big guys.
            </p>
          </div>

          <div className="glass p-6 text-left space-y-3">
            <div className="w-10 h-10 rounded-lg bg-[#20B2AA]/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-[#20B2AA]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="font-semibold text-lg">Atrium</h3>
            <p className="text-sm text-gray-400">
              AI-powered department heads that handle sales, support, and operations.
              Like having a Fortune 500 team on autopilot.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 px-6 py-8 text-center text-sm text-gray-500">
        © {new Date().getFullYear()} Orbit All rights reserved.
      </footer>
    </div>
  );
}
