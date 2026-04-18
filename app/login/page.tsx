"use client";

import { useState } from "react";
import Link from "next/link";
import { csrfFetch } from '@/lib/client-csrf';

type Mode = "login" | "signup";

function b64urlToBuffer(value: string): ArrayBuffer {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function bufferToB64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    setError("");

    const endpoint = mode === "signup" ? "/api/auth/signup" : "/api/auth/login";

    try {
      const res = await csrfFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json() as { error?: string };

      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        return;
      }

      window.location.href = "/dashboard";
    } catch {
      setError("Failed to connect. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handlePasskeySignIn = async () => {
    if (!email) {
      setError('Email is required for passkey sign in.');
      return;
    }

    setPasskeyLoading(true);
    setError('');

    try {
      const start = await csrfFetch('/api/auth/passkey/login/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const optionsData = await start.json() as any;
      if (!start.ok) {
        setError(optionsData.error || 'Unable to start passkey sign in.');
        return;
      }

      const credential = await navigator.credentials.get({
        publicKey: {
          challenge: b64urlToBuffer(optionsData.challenge),
          rpId: optionsData.rpId,
          timeout: optionsData.timeout ?? 60000,
          userVerification: optionsData.userVerification ?? 'preferred',
          allowCredentials: (optionsData.allowCredentials || []).map((item: any) => ({
            id: b64urlToBuffer(item.id),
            type: 'public-key',
            transports: item.transports,
          })),
        },
      }) as PublicKeyCredential | null;

      if (!credential) {
        setError('No passkey selected.');
        return;
      }

      const assertion = credential.response as AuthenticatorAssertionResponse;
      const verify = await csrfFetch('/api/auth/passkey/login/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          challengeId: optionsData.challengeId,
          credentialId: bufferToB64url(credential.rawId),
          authenticatorData: bufferToB64url(assertion.authenticatorData),
          clientDataJSON: bufferToB64url(assertion.clientDataJSON),
          signature: bufferToB64url(assertion.signature),
          userHandle: assertion.userHandle ? bufferToB64url(assertion.userHandle) : null,
        }),
      });

      const verifyData = await verify.json() as any;
      if (!verify.ok) {
        setError(verifyData.error || 'Passkey sign in failed.');
        return;
      }

      window.location.href = '/dashboard';
    } catch {
      setError('Passkey sign in failed. Please try password sign in.');
    } finally {
      setPasskeyLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-midnight flex items-center justify-center px-4">
      <div className="max-w-md w-full">
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

            {error && <p className="text-red-400 text-sm">{error}</p>}

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

          {mode === 'login' && (
            <>
              <div className="my-5 border-t border-white/10" />
              <button
                type="button"
                onClick={handlePasskeySignIn}
                disabled={passkeyLoading}
                className="w-full rounded-lg bg-white/10 px-6 py-3 font-semibold text-white hover:bg-white/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {passkeyLoading ? 'Waiting for passkey...' : 'Sign in with Passkey'}
              </button>
              <div className="text-right mt-3">
                <Link href="/forgot-password" className="text-sm text-white/60 hover:text-white/80 transition-colors">
                  Forgot password?
                </Link>
              </div>
            </>
          )}
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
