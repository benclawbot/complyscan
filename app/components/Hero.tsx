"use client";

import { useState } from "react";
import Link from "next/link";
import { ShieldCheck, ChevronDown } from "lucide-react";
import { LiveScanMeter } from "./ui/LiveScanMeter";
import { AnimatedCounter } from "./ui/AnimatedCounter";

export function Hero() {
  const [url, setUrl] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showScanDemo, setShowScanDemo] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/scan/free", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, email: email || undefined }),
      });

      const data = await res.json() as { scanId?: string; error?: string; code?: string };

      if (!res.ok) {
        if (data.code === "LIMIT_REACHED") {
          setError(`You've used your 3 free scans this month. Upgrade to Pro for unlimited scans.`);
        } else {
          setError(data.error || "Something went wrong. Please try again.");
        }
        return;
      }

      // Redirect to scan-results — page fetches result from /api/scan/[id]
      window.location.href = `/scan-results/${encodeURIComponent(data.scanId as string)}`;
    } catch {
      setError("Failed to start scan. Is the server running?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section
      id="hero"
      className="relative min-h-[90vh] flex flex-col items-center justify-center px-4 py-28 text-center overflow-hidden"
    >
      {/* Layered background */}
      <div className="absolute inset-0 bg-gradient-to-b from-midnight via-midnight to-midnight-light pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(79,142,247,0.12)_0%,transparent_60%)] pointer-events-none" />
      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="relative z-10 max-w-5xl mx-auto w-full">
        {/* Eyebrow label */}
        <div className="inline-flex items-center gap-2 rounded-full border border-accent-blue/20 bg-accent-blue/10 px-4 py-1.5 mb-8 animate-badge-in">
          <span className="w-1.5 h-1.5 rounded-full bg-accent-blue animate-pulse" />
          <span className="text-accent-blue text-xs font-semibold tracking-wider uppercase">
            AI-Powered GDPR Scanner
          </span>
        </div>

        {/* Headline */}
        <h1
          className="font-heading text-5xl sm:text-6xl lg:text-7xl font-bold text-white leading-[1.05] mb-6 tracking-tight"
          style={{ animation: "slide-up 0.6s ease-out both" }}
        >
          Is Your Website{" "}
          <span className="relative inline-block">
            <span className="text-risk-medium">GDPR</span>
            <span className="absolute -bottom-1 left-0 right-0 h-[3px] rounded-full bg-risk-medium/40" />
          </span>{" "}
          Compliant?
        </h1>

        {/* Subheadline */}
        <p
          className="text-lg sm:text-xl text-white/60 mb-12 max-w-2xl mx-auto leading-relaxed"
          style={{ animation: "slide-up 0.6s ease-out 0.1s both" }}
        >
          Free GDPR compliance scan in seconds. See every issue before your
          users do — no credit card required.
        </p>

        {/* Main content: form + demo side by side on large screens */}
        <div
          className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start max-w-4xl mx-auto mb-10"
          style={{ animation: "slide-up 0.6s ease-out 0.2s both" }}
        >
          {/* Left: scan form */}
          <div>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <input
                type="url"
                name="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://yourwebsite.com"
                required
                className="rounded-xl bg-midnight-light border border-white/15 px-5 py-4 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-accent-blue/60 focus:border-accent-blue/40 transition-all text-base"
              />
              <input
                type="email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="rounded-xl bg-midnight-light border border-white/15 px-5 py-4 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-accent-blue/60 focus:border-accent-blue/40 transition-all text-base"
              />
              {error && (
                <p className="text-risk-high text-sm text-left px-1 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-risk-high inline-block" />
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="rounded-xl bg-accent-blue px-8 py-4 font-bold text-white hover:bg-accent-glow transition-all shadow-glow-blue hover:shadow-blue-500/50 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed text-base mt-1 hover-scale"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Running scan...
                  </span>
                ) : (
                  "Scan Free →"
                )}
              </button>
            </form>
            <p className="text-white/25 text-xs mt-3">3 free scans per month · No credit card needed</p>
          </div>

          {/* Right: live scan demo */}
          <div className="glass rounded-2xl p-6 border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <span className="text-white/40 text-xs font-semibold uppercase tracking-wider">Live Demo</span>
              <button
                onClick={() => setShowScanDemo(!showScanDemo)}
                className="text-white/30 hover:text-white/60 text-xs transition-colors"
              >
                {showScanDemo ? "Hide" : "Show"}
              </button>
            </div>
            {showScanDemo && <LiveScanMeter url="example.com" autoStart={true} />}
          </div>
        </div>

        {/* Stats row */}
        <div
          className="flex flex-wrap items-center justify-center gap-8 sm:gap-12 mb-12"
          style={{ animation: "slide-up 0.6s ease-out 0.3s both" }}
        >
          {[
            { value: 2847, suffix: "+", label: "Sites scanned" },
            { value: 4, suffix: ".2", label: "Avg issues found" },
            { value: 98, suffix: "%", label: "Uptime" },
          ].map(({ value, suffix, label }) => (
            <div key={label} className="text-center">
              <p className="font-heading text-2xl sm:text-3xl font-bold text-white">
                <AnimatedCounter end={value} suffix={suffix} duration={1800} />
              </p>
              <p className="text-white/40 text-xs mt-0.5 uppercase tracking-wider">{label}</p>
            </div>
          ))}
        </div>

        {/* Subscriber link */}
        <div className="mb-8" style={{ animation: "slide-up 0.6s ease-out 0.35s both" }}>
          <Link
            href="/login"
            className="text-sm text-white/35 hover:text-white/60 transition-colors inline-flex items-center gap-1.5"
          >
            Subscriber dashboard
            <ChevronDown className="w-3.5 h-3.5 rotate-[-90deg]" />
          </Link>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 opacity-30">
        <span className="text-[10px] uppercase tracking-widest text-white/50">Scroll</span>
        <ChevronDown className="w-4 h-4 text-white/50 animate-bounce" />
      </div>
    </section>
  );
}
