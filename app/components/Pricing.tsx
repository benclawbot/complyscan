"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { RevealSection } from "./ui/RevealSection";
import { SampleReportPreview } from "./ui/SampleReportPreview";

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description:
      "See what&apos;s on your site before attackers or regulators do. Full issue breakdown, no credit card.",
    features: [
      "3 scans per month",
      "Issue detection & severity",
      "AI-powered analysis",
      "Basic fix suggestions",
      "PDF report preview",
    ],
    plan: "free" as const,
    cta: "Scan Free",
    ctaAction: "scroll",
    badge: null,
    borderClass: "border-white/[0.07]",
    riskDot: "bg-white/30",
  },
  {
    name: "Pro",
    price: "$29",
    period: "per report",
    description:
      "The full picture — legal article references, executive summary, and step-by-step remediation.",
    features: [
      "Full PDF compliance report",
      "Legal article references (GDPR, ePrivacy)",
      "Detailed fix recommendations",
      "Executive summary",
      "Priority email support",
    ],
    plan: "pdf" as const,
    cta: "Get PDF Report",
    ctaAction: "checkout",
    badge: "Most Popular",
    badgeClass: "bg-accent-blue/15 border-accent-blue/30 text-accent-blue",
    borderClass: "border-accent-blue/30",
    riskDot: "bg-risk-medium",
    highlight: true,
  },
  {
    name: "Agency",
    price: "$99",
    period: "per month",
    description:
      "Unlimited scans for all your client websites. White-label reports and a client management dashboard.",
    features: [
      "Unlimited scans",
      "White-label PDF reports",
      "Manage up to 50 clients",
      "Historical scan comparison",
      "Priority email support",
    ],
    plan: "monthly" as const,
    cta: "Start Agency",
    ctaAction: "checkout",
    badge: null,
    borderClass: "border-white/[0.07]",
    riskDot: "bg-white/30",
  },
];

export function Pricing() {
  const [loading, setLoading] = useState<string | null>(null);

  const handleCheckout = async (plan: "pdf" | "monthly") => {
    setLoading(plan);

    try {
      let payload: { url?: string; email?: string; plan: "pdf" | "monthly" } = { plan };

      if (plan === "pdf") {
        const enteredUrl = window.prompt("Enter the website URL for your PDF report", "https://example.com")?.trim();
        if (!enteredUrl) {
          setLoading(null);
          return;
        }
        payload = { plan, url: enteredUrl };
      }

      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json() as { url?: string; error?: string };

      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "Something went wrong. Please try again.");
      }
    } catch {
      alert("Failed to start checkout. Please try again.");
    } finally {
      setLoading(null);
    }
  };

  const scrollToHero = () => {
    const hero = document.getElementById("hero");
    if (hero) hero.scrollIntoView({ behavior: "smooth", block: "center" });
    else window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <section id="pricing" className="py-28 px-4 relative">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-midnight-light/20 via-midnight to-midnight pointer-events-none" />

      <div className="mx-auto max-w-6xl relative z-10">
        <RevealSection className="text-center mb-6">
          <h2 className="font-heading text-3xl sm:text-4xl font-bold text-white mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-white/50 text-lg max-w-xl mx-auto">
            Start free. Upgrade when you need the full report. No hidden fees, no sales calls.
          </p>
        </RevealSection>

        {/* Risk meter decoration */}
        <RevealSection delay={1} className="flex items-center justify-center gap-3 mb-16">
          <div className="flex items-center gap-1.5 text-xs text-white/30">
            <span className="w-2 h-2 rounded-full bg-risk-high" />
            High risk
          </div>
          <div className="h-1 w-24 rounded-full bg-gradient-to-r from-risk-high via-risk-medium to-risk-low opacity-40" />
          <div className="flex items-center gap-1.5 text-xs text-white/30">
            <span className="w-2 h-2 rounded-full bg-risk-low" />
            Compliant
          </div>
        </RevealSection>

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-16">
          {plans.map((plan, i) => (
            <RevealSection key={plan.name} delay={(i + 1) as 1 | 2 | 3}>
              <div
                className={`relative glass rounded-2xl p-8 flex flex-col h-full transition-all hover-lift ${
                  plan.borderClass
                } ${plan.highlight ? "shadow-glow-blue scale-[1.02]" : ""}`}
              >
                {/* Badge */}
                {plan.badge && (
                  <div
                    className={`inline-flex items-center gap-1.5 rounded-full text-xs font-semibold px-3 py-1 mb-5 w-fit border ${plan.badgeClass}`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                    {plan.badge}
                  </div>
                )}

                {/* Plan name + price */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-2 h-2 rounded-full ${plan.riskDot}`} />
                    <h3 className="font-heading text-lg font-semibold text-white">
                      {plan.name}
                    </h3>
                  </div>
                  <div className="flex items-baseline gap-1.5 mt-2">
                    <span className="font-heading text-5xl font-bold text-white">
                      {plan.price}
                    </span>
                    <span className="text-white/40 text-sm">{plan.period}</span>
                  </div>
                  <p
                    className="text-white/40 text-sm mt-3 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: plan.description }}
                  />
                </div>

                {/* Features */}
                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3 text-sm text-white/60">
                      <Check className="w-4 h-4 text-risk-low flex-shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <button
                  onClick={() => {
                    if (plan.ctaAction === "scroll") {
                      scrollToHero();
                    } else {
                      handleCheckout(plan.plan as "pdf" | "monthly");
                    }
                  }}
                  disabled={loading !== null}
                  className={`w-full rounded-xl py-3.5 px-6 font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed hover-scale ${
                    plan.highlight
                      ? "bg-accent-blue text-white hover:bg-accent-glow shadow-glow-blue"
                      : "bg-white/[0.07] text-white hover:bg-white/[0.12] border border-white/[0.1]"
                  }`}
                >
                  {loading === plan.plan ? "Redirecting..." : plan.cta}
                </button>
              </div>
            </RevealSection>
          ))}
        </div>

        {/* Sample report preview */}
        <RevealSection delay={2}>
          <div className="text-center mb-6">
            <p className="text-white/30 text-xs uppercase tracking-widest mb-1">See it in action</p>
            <p className="text-white/50 text-sm">Here's what a real compliance report looks like</p>
          </div>
          <SampleReportPreview />
        </RevealSection>
      </div>
    </section>
  );
}
