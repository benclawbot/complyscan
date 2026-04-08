"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/app/lib/utils";
import { RevealSection } from "./ui/RevealSection";

const faqs = [
  {
    question: "How does the scan work?",
    answer:
      "Our system uses an automated crawler to visit your website, analyze the HTML, meta tags, cookie banners, privacy policy links, and third-party scripts. The results are then processed through our AI analysis engine to identify GDPR compliance gaps.",
  },
  {
    question: "Is my URL stored?",
    answer:
      "Your URL is processed to perform the scan and is stored only as part of your scan history if you purchase a report. We do not share your URL with third parties, and it is not made publicly accessible. Scan data is retained for 30 days then automatically deleted.",
  },
  {
    question: "What happens after payment?",
    answer:
      "After successful payment, your scan is automatically triggered and typically completes within 2 minutes. Your full report is available in-app with a detailed breakdown of every compliance issue found, its severity, and actionable fix recommendations.",
  },
  {
    question: "Can I get a refund?",
    answer:
      "If your scan completes but returns no findings (blank report), we offer a full refund. If you are unsatisfied with the report for any reason within 7 days of purchase, contact our support team and we will work to resolve your concern.",
  },
  {
    question: "Is this suitable for EU websites only?",
    answer:
      "GDPR applies to any website that collects data from or targets users in the European Union, regardless of where your business is based. ComplyScan is designed to audit against GDPR requirements specifically, which is the strictest privacy regulation globally. If you are compliant with GDPR, you will be well positioned for other regulations like CCPA.",
  },
];

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="py-28 px-4 relative">
      {/* Gradient divider */}
      <div className="absolute inset-0 bg-gradient-to-b from-midnight via-midnight to-midnight-light/20 pointer-events-none" />

      <div className="mx-auto max-w-3xl relative z-10">
        <RevealSection className="text-center mb-16">
          <h2 className="font-heading text-3xl sm:text-4xl font-bold text-white mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-white/50 text-lg">
            Everything you need to know before scanning your site.
          </p>
        </RevealSection>

        <div className="space-y-3">
          {faqs.map((faq, index) => (
            <RevealSection key={index} delay={(index % 3 + 1) as 1 | 2 | 3}>
              <div className="glass rounded-2xl overflow-hidden border border-white/[0.06] hover:border-white/[0.1] transition-colors">
                <button
                  onClick={() => setOpenIndex(openIndex === index ? null : index)}
                  className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left hover:bg-white/[0.02] transition-colors"
                >
                  <span className="font-medium text-white text-sm">{faq.question}</span>
                  <ChevronDown
                    className={cn(
                      "w-4 h-4 text-white/40 flex-shrink-0 transition-transform duration-200",
                      openIndex === index && "rotate-180"
                    )}
                  />
                </button>
                <div
                  className={cn(
                    "overflow-hidden transition-all duration-300 ease-in-out",
                    openIndex === index ? "max-h-64" : "max-h-0"
                  )}
                >
                  <div className="px-6 pb-5">
                    <div className="w-full h-px bg-white/[0.06] mb-4" />
                    <p className="text-white/50 text-sm leading-relaxed">{faq.answer}</p>
                  </div>
                </div>
              </div>
            </RevealSection>
          ))}
        </div>
      </div>
    </section>
  );
}

