"use client";

import { useState } from "react";

interface CheckoutModalProps {
  plan: "pdf" | "monthly";
  onConfirm: (url?: string) => void;
  onCancel: () => void;
}

export function CheckoutModal({ plan, onConfirm, onCancel }: CheckoutModalProps) {
  const [url, setUrl] = useState("https://");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (plan === "pdf") {
      const trimmed = url.trim();
      if (!trimmed || trimmed === "https://") {
        setError("Please enter a valid website URL");
        return;
      }
      try {
        new URL(trimmed);
      } catch {
        setError("Please enter a valid URL (e.g., https://example.com)");
        return;
      }
      onConfirm(trimmed);
    } else {
      onConfirm();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="relative glass rounded-2xl p-8 w-full max-w-md mx-4 shadow-2xl border border-white/10">
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 text-white/40 hover:text-white/70 transition-colors"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h2 className="font-heading text-xl font-bold text-white mb-2">
          {plan === "pdf" ? "Get Your PDF Report" : "Start Agency Plan"}
        </h2>
        <p className="text-white/50 text-sm mb-6">
          {plan === "pdf"
            ? "Enter the website URL you want to scan and get a detailed compliance report."
            : "Get unlimited scans and white-label reports for your clients."}
        </p>

        <form onSubmit={handleSubmit}>
          {plan === "pdf" && (
            <div className="mb-6">
              <label htmlFor="website-url" className="block text-white/70 text-sm font-medium mb-2">
                Website URL
              </label>
              <input
                id="website-url"
                type="url"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setError("");
                }}
                placeholder="https://example.com"
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-accent-blue/50 focus:ring-1 focus:ring-accent-blue/30 transition-all text-sm"
                autoFocus
              />
              {error && (
                <p className="text-red-400 text-xs mt-2">{error}</p>
              )}
            </div>
          )}

          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-white font-semibold text-lg">
                {plan === "pdf" ? "$29" : "$99"}
                <span className="text-white/40 text-sm font-normal ml-1">
                  {plan === "pdf" ? "one-time" : "/month"}
                </span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-white/50 text-xs">
                {plan === "pdf" ? "Full PDF report + email delivery" : "Unlimited scans + client dashboard"}
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-3 px-4 rounded-xl bg-white/5 border border-white/10 text-white/70 text-sm font-medium hover:bg-white/10 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-3 px-4 rounded-xl bg-accent-blue text-white text-sm font-bold hover:bg-accent-glow shadow-glow-blue transition-all"
            >
              Continue to Payment
            </button>
          </div>

          <p className="text-white/30 text-xs text-center mt-4">
            Secure payment via Stripe · Powered by ComplyScan
          </p>
        </form>
      </div>
    </div>
  );
}
