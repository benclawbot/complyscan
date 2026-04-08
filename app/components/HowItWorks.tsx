"use client";

import { Link, ScanSearch, MailCheck } from "lucide-react";
import { RevealSection } from "./ui/RevealSection";

const steps = [
  {
    icon: Link,
    title: "Enter your URL",
    description:
      "Type your website address into our secure scanner. No signup, no account needed — just paste and go.",
    accent: "accent-blue",
  },
  {
    icon: ScanSearch,
    title: "We scan automatically",
    description:
      "Our AI crawler checks 40+ GDPR signals: cookie banners, privacy policies, tracking scripts, SSL, form labels, and third-party embeds.",
    accent: "warning",
  },
  {
    icon: MailCheck,
    title: "Get your full report",
    description:
      "Review a detailed compliance report with every issue, severity rating, legal references, and step-by-step fix guides. Print or save as PDF from your browser.",
    accent: "success",
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="relative py-28 px-4"
    >
      {/* Subtle top gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-midnight-light/20 via-transparent to-transparent pointer-events-none" />

      <div className="mx-auto max-w-6xl relative z-10">
        <RevealSection className="text-center mb-16">
          <h2 className="font-heading text-3xl sm:text-4xl font-bold text-white mb-4">
            Three Steps to Compliance
          </h2>
          <p className="text-white/50 text-lg max-w-xl mx-auto">
            From URL to actionable report in under 2 minutes. Fully automated — no manual work.
          </p>
        </RevealSection>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
          {/* Connecting line (desktop) */}
          <div className="hidden md:block absolute top-[3.25rem] left-[16.67%] right-[16.67%] h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

          {steps.map((step, index) => (
            <RevealSection key={step.title} delay={(index + 1) as 1 | 2 | 3} className="relative">
              <div className="glass rounded-2xl p-8 text-center hover-lift border border-white/[0.07] hover:border-white/[0.14] transition-all h-full">
                {/* Step number — positioned at top */}
                <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-midnight-light border border-white/10 text-white/40 text-xs font-bold mb-6">
                  {index + 1}
                </div>

                {/* Icon with colored glow */}
                <div
                  className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-5 relative`}
                  style={{
                    background: `rgba(${step.accent === "accent-blue" ? "79,142,247" : step.accent === "warning" ? "245,158,11" : "34,197,94"}, 0.1)`,
                    boxShadow: `0 0 30px rgba(${step.accent === "accent-blue" ? "79,142,247" : step.accent === "warning" ? "245,158,11" : "34,197,94"}, 0.15)`,
                  }}
                >
                  <step.icon
                    className="w-8 h-8"
                    style={{
                      color: step.accent === "accent-blue" ? "#4f8ef7" : step.accent === "warning" ? "#f59e0b" : "#22c55e",
                    }}
                  />
                </div>

                <h3 className="font-heading text-xl font-semibold text-white mb-3">
                  {step.title}
                </h3>
                <p className="text-white/50 text-sm leading-relaxed">
                  {step.description}
                </p>
              </div>
            </RevealSection>
          ))}
        </div>
      </div>
    </section>
  );
}

