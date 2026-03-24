"use client";

interface SubscriptionCardProps {
  name: string;
  price: number;
  features: string[];
  highlighted?: boolean;
  current?: boolean;
  loading?: boolean;
  onSelect?: () => void;
}

export function SubscriptionCard({
  name,
  price,
  features,
  highlighted,
  current,
  loading,
  onSelect,
}: SubscriptionCardProps) {
  return (
    <div
      className={`relative p-6 rounded-2xl border transition-all ${
        highlighted
          ? "border-[#2B2FFF]/50 bg-[#2B2FFF]/5"
          : "border-white/10 bg-[rgba(28,28,33,0.7)]"
      }`}
    >
      {highlighted && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-xs font-medium gradient-primary">
          Most Popular
        </div>
      )}

      <div className="space-y-4">
        <h3 className="font-semibold text-lg">{name}</h3>

        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-bold">${price}</span>
          <span className="text-sm text-gray-400">/month</span>
        </div>

        <ul className="space-y-2.5 pt-2">
          {features.map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-sm">
              <span className="text-[#20B2AA] mt-0.5">✓</span>
              <span className="text-gray-300">{feature}</span>
            </li>
          ))}
        </ul>

        <button
          onClick={onSelect}
          disabled={current || loading}
          className={`w-full py-2.5 rounded-lg text-sm font-medium transition-all ${
            current
              ? "bg-white/5 text-gray-500 cursor-default"
              : loading
                ? "bg-white/5 text-gray-400 cursor-wait"
                : highlighted
                  ? "gradient-primary hover:opacity-90"
                  : "bg-white/10 hover:bg-white/15 text-white"
          }`}
        >
          {current ? "Current Plan" : loading ? "Redirecting..." : "Upgrade"}
        </button>
      </div>
    </div>
  );
}
