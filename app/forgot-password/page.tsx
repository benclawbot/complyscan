"use client";

import { useState } from 'react';
import Link from 'next/link';
import { csrfFetch } from '@/lib/client-csrf';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await csrfFetch('/api/auth/recovery-codes/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, newPassword }),
      });

      const data = await res.json() as { error?: string };
      if (!res.ok) {
        setError(data.error || 'Unable to reset password.');
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 1000);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-midnight flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-midnight-light border border-white/10 rounded-2xl p-8">
        <h1 className="text-2xl font-bold text-white mb-2">Reset password</h1>
        <p className="text-white/60 text-sm mb-6">Use a recovery code to set a new password. No email is required.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-white/70 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg bg-midnight border border-white/20 px-4 py-3 text-white"
            />
          </div>

          <div>
            <label className="block text-sm text-white/70 mb-1">Recovery code</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABCDE-12345"
              required
              className="w-full rounded-lg bg-midnight border border-white/20 px-4 py-3 text-white uppercase"
            />
          </div>

          <div>
            <label className="block text-sm text-white/70 mb-1">New password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
              required
              className="w-full rounded-lg bg-midnight border border-white/20 px-4 py-3 text-white"
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}
          {success && <p className="text-green-400 text-sm">Password reset. Redirecting to dashboard...</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-accent-blue px-6 py-3 font-semibold text-white hover:bg-accent-glow disabled:opacity-50"
          >
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link href="/login" className="text-sm text-white/60 hover:text-white/80">Back to login</Link>
        </div>
      </div>
    </div>
  );
}
