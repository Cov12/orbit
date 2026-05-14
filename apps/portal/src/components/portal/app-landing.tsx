"use client";

import { useState } from "react";
import { SubscriptionCard } from "./subscription-card";

interface Feature {
  icon: React.ReactNode;
  title: string;
  description: string;
}

interface Plan {
  name: string;
  description: string;
  price: number;
  app: string;
  plan: string;
  features: string[];
  highlighted?: boolean;
}

interface AppLandingProps {
  name: string;
  tagline: string;
  description: string;
  color: string;
  icon: React.ReactNode;
  videoUrl?: string;
  previewImage?: string;
  launchUrl?: string;
  status: "active" | "inactive" | "coming_soon" | "bundled" | "coming_online";
  features: Feature[];
  plans?: Plan[];
  freeNote?: string;
  bundledNote?: string;
  callbackPath?: string;
  launchEnabled?: boolean;
}

export function AppLanding({
  name,
  tagline,
  description,
  color,
  icon,
  videoUrl,
  previewImage,
  launchUrl,
  status,
  features,
  plans,
  freeNote,
  bundledNote,
  callbackPath = "/atrium/auth/callback",
  launchEnabled = true,
}: AppLandingProps) {
  const [loading, setLoading] = useState<string | null>(null);

  async function handleSelect(app: string, plan: string) {
    const key = `${app}-${plan}`;
    setLoading(key);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ app, plan }),
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
    <div className="space-y-16 pb-12">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl" style={{ minHeight: "420px" }}>
        {/* Animated gradient background */}
        <div className="absolute inset-0 animate-gradient-shift" style={{
          background: `
            radial-gradient(ellipse at 20% 50%, ${color}44 0%, transparent 50%),
            radial-gradient(ellipse at 80% 20%, ${color}22 0%, transparent 50%),
            radial-gradient(ellipse at 50% 80%, ${color}18 0%, transparent 50%),
            linear-gradient(180deg, #0f0f13 0%, #1a1a24 50%, #0f0f13 100%)
          `,
          backgroundSize: "200% 200%",
        }} />
        {/* Floating orbs */}
        <div className="absolute inset-0 overflow-hidden">
          <div
            className="absolute rounded-full blur-3xl animate-float-slow"
            style={{
              width: "300px", height: "300px",
              background: `${color}15`,
              top: "10%", left: "10%",
            }}
          />
          <div
            className="absolute rounded-full blur-3xl animate-float-slower"
            style={{
              width: "200px", height: "200px",
              background: `${color}10`,
              bottom: "10%", right: "15%",
            }}
          />
          <div
            className="absolute rounded-full blur-2xl animate-float-medium"
            style={{
              width: "150px", height: "150px",
              background: `${color}0d`,
              top: "40%", right: "30%",
            }}
          />
        </div>
        {/* Grid pattern overlay */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }} />
        {/* Video (if provided) */}
        {videoUrl && (
          <video
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover opacity-30 mix-blend-screen"
            src={videoUrl}
          />
        )}
        {/* Content */}
        <div className="relative z-10 flex flex-col items-center justify-center text-center px-6 py-20" style={{ minHeight: "420px" }}>
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-sm"
            style={{ backgroundColor: `${color}25`, border: `1px solid ${color}40` }}
          >
            <div style={{ color }} className="w-8 h-8">
              {icon}
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-3">{name}</h1>
          <p className="text-xl md:text-2xl font-light mb-2" style={{ color }}>
            {tagline}
          </p>
          <p className="text-gray-400 max-w-xl mb-8 leading-relaxed">{description}</p>

          <div className="flex gap-4 flex-wrap justify-center">
            {(status === "active" || status === "bundled") && launchUrl && launchEnabled ? (
              <a
                href={`/api/auth/refresh?redirect_uri=${encodeURIComponent(launchUrl + callbackPath)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-8 py-3 rounded-xl font-semibold text-white transition-all hover:scale-105 hover:shadow-lg hover:shadow-current/20"
                style={{ backgroundColor: color }}
              >
                Launch {name} →
              </a>
            ) : status === "inactive" ? (
              <a
                href="#pricing"
                className="px-8 py-3 rounded-xl font-semibold text-white transition-all hover:scale-105 hover:shadow-lg"
                style={{ backgroundColor: color }}
              >
                View Plans →
              </a>
            ) : status === "coming_online" || ((status === "active" || status === "bundled") && !launchEnabled) ? (
              <div className="px-8 py-3 rounded-xl font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 cursor-default">
                Coming online
              </div>
            ) : (
              <div className="px-8 py-3 rounded-xl font-semibold bg-white/10 text-gray-400 cursor-default">
                Coming Soon
              </div>
            )}
            <a
              href="/apps"
              className="px-8 py-3 rounded-xl font-semibold bg-white/10 text-white hover:bg-white/15 transition-all"
            >
              ← All Apps
            </a>
          </div>
        </div>
      </section>

      {/* Preview Image */}
      {previewImage && (
        <section className="mb-12">
          <div className="relative mx-auto max-w-5xl rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-black/40">
            <img
              src={previewImage}
              alt={`${name} dashboard preview`}
              className="w-full h-auto"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f13] via-transparent to-transparent opacity-60 pointer-events-none" />
          </div>
        </section>
      )}

      {/* Features */}
      <section>
        <h2 className="text-2xl font-bold text-center mb-10">What&apos;s Included</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <div key={f.title} className="glass-hover p-6 space-y-3 group">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110"
                style={{ backgroundColor: `${color}20` }}
              >
                <div style={{ color }}>{f.icon}</div>
              </div>
              <h3 className="font-semibold text-lg">{f.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      {plans && plans.length > 0 && (
        <section id="pricing">
          <h2 className="text-2xl font-bold text-center mb-3">Choose Your Plan</h2>
          <p className="text-gray-400 text-center mb-10 max-w-lg mx-auto">
            Start small and scale as you grow. All plans include Orbit Drive storage.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {plans.map((p) => (
              <SubscriptionCard
                key={`${p.app}-${p.plan}`}
                name={p.name}
                description={p.description}
                price={p.price}
                features={p.features}
                highlighted={p.highlighted}
                loading={loading === `${p.app}-${p.plan}`}
                onSelect={() => handleSelect(p.app, p.plan)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Free note for Drive */}
      {freeNote && (
        <section className="text-center">
          <div className="glass inline-block px-8 py-6 max-w-lg">
            <p className="text-lg font-semibold mb-1" style={{ color }}>
              Free with any subscription
            </p>
            <p className="text-gray-400 text-sm leading-relaxed">{freeNote}</p>
          </div>
        </section>
      )}

      {/* Bundled note (Conductor, included with Atrium) */}
      {bundledNote && (
        <section className="text-center">
          <div className="glass inline-block px-8 py-6 max-w-lg border border-emerald-500/20">
            <p className="text-lg font-semibold mb-1 italic" style={{ color }}>
              Included with Atrium
            </p>
            <p className="text-gray-400 text-sm leading-relaxed">{bundledNote}</p>
          </div>
        </section>
      )}
    </div>
  );
}
