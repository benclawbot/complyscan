"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle, ChevronRight } from "lucide-react";

export function SampleReportPreview() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="glass rounded-2xl p-6 border border-white/10 hover-lift cursor-pointer max-w-sm mx-auto"
      onClick={() => setExpanded(!expanded)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-risk-medium-bg border border-risk-medium-border flex items-center justify-center">
            <AlertTriangle className="w-4 h-4 text-risk-medium" />
          </div>
          <span className="text-sm font-medium text-white/70">Sample Report</span>
        </div>
        <span className="text-xs text-white/30 hover:text-white/60 transition-colors">
          {expanded ? "Collapse" : "See full report →"}
        </span>
      </div>

      {/* Score gauge */}
      <div className="flex items-center gap-4 mb-4">
        <div className="relative w-20 h-20 flex-shrink-0">
          <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
            <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
            <circle
              cx="40" cy="40" r="32" fill="none"
              stroke="#f59e0b" strokeWidth="6"
              strokeDasharray={`${0.68 * 2 * Math.PI * 32} ${2 * Math.PI * 32}`}
              strokeLinecap="round"
              className="transition-all duration-700"
              style={{ filter: "drop-shadow(0 0 6px rgba(245,158,11,0.5))" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-bold text-risk-medium">68</span>
            <span className="text-[9px] text-white/40 uppercase tracking-wider">Score</span>
          </div>
        </div>
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 bg-risk-medium-bg border border-risk-medium-border mb-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-risk-medium animate-pulse" />
            <span className="text-xs font-semibold text-risk-medium">MEDIUM RISK</span>
          </div>
          <p className="text-sm text-white/50">example.com</p>
          <p className="text-xs text-white/30">4 issues found</p>
        </div>
      </div>

      {/* Issue list */}
      <div className="space-y-2 mb-4">
        {[
          { icon: AlertTriangle, label: "Cookie banner missing", severity: "high" },
          { icon: AlertTriangle, label: "No privacy policy page", severity: "high" },
          { icon: CheckCircle, label: "SSL/HTTPS active", severity: "low" },
          { icon: AlertTriangle, label: "Tracking scripts need review", severity: "medium" },
        ].map(({ icon: Icon, label, severity }) => (
          <div key={label} className="flex items-center gap-2.5 text-sm">
            <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${
              severity === "high" ? "bg-risk-high-bg" :
              severity === "medium" ? "bg-risk-medium-bg" :
              "bg-risk-low-bg"
            }`}>
              <Icon className={`w-3 h-3 ${
                severity === "high" ? "text-risk-high" :
                severity === "medium" ? "text-risk-medium" :
                "text-risk-low"
              }`} />
            </div>
            <span className="text-white/60">{label}</span>
            <span className={`ml-auto text-[10px] font-semibold uppercase tracking-wider ${
              severity === "high" ? "text-risk-high" :
              severity === "medium" ? "text-risk-medium" :
              "text-risk-low"
            }`}>{severity}</span>
          </div>
        ))}
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-white/10 pt-4 space-y-2 animate-slide-up">
          {["Form labels incomplete", "Third-party embed detected"].map((item) => (
            <div key={item} className="flex items-center gap-2.5 text-sm">
              <div className="w-5 h-5 rounded flex items-center justify-center bg-risk-medium-bg flex-shrink-0">
                <AlertTriangle className="w-3 h-3 text-risk-medium" />
              </div>
              <span className="text-white/60">{item}</span>
              <span className="ml-auto text-[10px] font-semibold uppercase tracking-wider text-risk-medium">medium</span>
            </div>
          ))}
        </div>
      )}

      {/* CTA */}
      <button className="w-full mt-4 rounded-lg border border-accent-blue/30 text-accent-blue text-sm font-semibold py-2.5 hover:bg-accent-blue/10 hover:border-accent-blue/50 transition-all flex items-center justify-center gap-1.5 group">
        Try it on your site — free
        <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
      </button>
    </div>
  );
}
