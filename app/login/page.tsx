"use client";

import { useState } from "react";
import Link from "next/link";

type Mode = "login" | "signup";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [subscriberEmail, setSubscriberEmail] = useState("");
  const [subscriberLoading, setSubscriberLoading] = useState(false);
  const [subscriberError, setSubscriberError] = useState("");
  const [subscriberSuccess, setSubscriberSuccess] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    setError("");

    const endpoint = mode === "signup" ? "/api/auth/signup" : "/api/auth/login";

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json() as { error?: string };

      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        return;
      }

      // Redirect to dashboard on success
      window.location.href = "/dashboard";
    } catch {
      setError("Failed to connect. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubscriberAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subscriberEmail) return;

    setSubscriberLoading(true);
    setSubscriberError("");
    setSubscriberSuccess("");

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: subscriberEmail }),
      });

      const data = await res.json() as { message?: string; error?: string };
      if (!res.ok) {
        setSubscriberError(data.error || 'Unable to send secure login email.');
        return;
      }

      setSubscriberSuccess(data.message || 'If the email matches an active subscription, we sent a secure dashboard link.');
    } catch {
      setSubscriberError('Failed to connect. Please try again.');
    } finally {
      setSubscriberLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-midnight flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="font-heading text-2xl font-bold text-white hover:text-accent-glow transition-colors">
            ComplyScan
          </Link>
          <h1 className="text-2xl font-bold text-white mt-6 mb-2">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="text-white/60">
            {mode === "login" ? "Sign in to access your reports" : "Sign up to save and access your reports"}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-midnight-light rounded-lg p-1">
          <button
            onClick={() => { setMode("login"); setError(""); }}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
              mode === "login"
                ? "bg-white/10 text-white"
                : "text-white/50 hover:text-white/70"
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => { setMode("signup"); setError(""); }}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
              mode === "signup"
                ? "bg-white/10 text-white"
                : "text-white/50 hover:text-white/70"
            }`}
          >
            Sign Up
          </button>
        </div>

        {/* Card */}
        <div className="bg-midnight-light border border-white/10 rounded-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm text-white/70 mb-2">
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full rounded-lg bg-midnight border border-white/20 px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm text-white/70 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "signup" ? "At least 8 characters" : "••••••••"}
                required
                minLength={mode === "signup" ? 8 : 1}
                className="w-full rounded-lg bg-midnight border border-white/20 px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent transition-all"
              />
            </div>

            {error && (
              <p className="text-red-400 text-sm">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-accent-blue px-6 py-3 font-semibold text-white hover:bg-accent-glow transition-all shadow-lg shadow-accent-blue/30 hover:shadow-accent-blue/50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading
                ? mode === "signup" ? "Creating account..." : "Signing in..."
                : mode === "signup" ? "Create Account" : "Sign In"}
            </button>
          </form>
        </div>

        <div className="bg-midnight-light border border-white/10 rounded-2xl p-6 mt-5">
          <h2 className="text-white font-semibold mb-1">Agency subscriber access</h2>
          <p className="text-white/50 text-sm mb-4">
            Already on the Agency plan? Enter your billing email and we&apos;ll send a secure dashboard link.
          </p>
          <form onSubmit={handleSubscriberAccess} className="space-y-3">
            <input
              type="email"
              value={subscriberEmail}
              onChange={(e) => setSubscriberEmail(e.target.value)}
              placeholder="agency@yourcompany.com"
              required
              className="w-full rounded-lg bg-midnight border border-white/20 px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-accent-blue"
            />
            {subscriberError && <p className="text-red-400 text-sm">{subscriberError}</p>}
            {subscriberSuccess && <p className="text-green-400 text-sm">{subscriberSuccess}</p>}
            <button
              type="submit"
              disabled={subscriberLoading}
              className="w-full rounded-lg bg-white/10 px-6 py-3 font-semibold text-white hover:bg-white/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {subscriberLoading ? 'Sending link...' : 'Email me my dashboard link'}
            </button>
          </form>
        </div>

        <div className="text-center mt-6">
          <Link href="/" className="text-sm text-white/50 hover:text-white/70 transition-colors">
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}







