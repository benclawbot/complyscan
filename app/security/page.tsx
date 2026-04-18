"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { csrfFetch } from '@/lib/client-csrf';

type PasskeyCredential = {
  id: string;
  label: string;
  createdAt: string;
  updatedAt: string;
};

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

export default function SecurityPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [credentials, setCredentials] = useState<PasskeyCredential[]>([]);
  const [registeringPasskey, setRegisteringPasskey] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [generatingCodes, setGeneratingCodes] = useState(false);

  const loadCredentials = async () => {
    const res = await fetch('/api/auth/passkey/credentials');
    if (!res.ok) {
      throw new Error('Failed to load security settings');
    }
    const data = await res.json() as { credentials?: PasskeyCredential[] };
    setCredentials(Array.isArray(data.credentials) ? data.credentials : []);
  };

  useEffect(() => {
    loadCredentials()
      .catch((e) => setError(e.message || 'Failed to load security settings'))
      .finally(() => setLoading(false));
  }, []);

  const handleAddPasskey = async () => {
    setRegisteringPasskey(true);
    setError('');

    try {
      const start = await csrfFetch('/api/auth/passkey/register/options', { method: 'POST' });
      const optionsData = await start.json() as any;
      if (!start.ok) {
        setError(optionsData.error || 'Unable to start passkey registration.');
        return;
      }

      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: b64urlToBuffer(optionsData.challenge),
          rp: { id: optionsData.rpId, name: optionsData.rpName || 'ComplyScan' },
          user: {
            id: new TextEncoder().encode(optionsData.user.id),
            name: optionsData.user.name,
            displayName: optionsData.user.displayName,
          },
          pubKeyCredParams: optionsData.pubKeyCredParams,
          timeout: optionsData.timeout ?? 60000,
          authenticatorSelection: optionsData.authenticatorSelection,
          attestation: optionsData.attestation ?? 'none',
          excludeCredentials: (optionsData.excludeCredentials || []).map((item: any) => ({
            id: b64urlToBuffer(item.id),
            type: 'public-key',
            transports: item.transports,
          })),
        },
      }) as PublicKeyCredential | null;

      if (!credential) {
        setError('Passkey registration cancelled.');
        return;
      }

      const response = credential.response as AuthenticatorAttestationResponse;
      const verify = await csrfFetch('/api/auth/passkey/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId: optionsData.challengeId,
          credentialId: bufferToB64url(credential.rawId),
          publicKey: bufferToB64url(response.getPublicKey() || new ArrayBuffer(0)),
          counter: 0,
          transports: response.getTransports ? response.getTransports() : [],
          clientDataJSON: bufferToB64url(response.clientDataJSON),
        }),
      });

      const verifyData = await verify.json().catch(() => ({})) as any;
      if (!verify.ok) {
        setError(verifyData.error || 'Failed to save passkey.');
        return;
      }

      await loadCredentials();
    } catch {
      setError('Passkey registration failed.');
    } finally {
      setRegisteringPasskey(false);
    }
  };

  const handleDeletePasskey = async (id: string) => {
    const res = await csrfFetch('/api/auth/passkey/credentials', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });

    if (!res.ok) {
      setError('Unable to remove passkey.');
      return;
    }

    await loadCredentials();
  };

  const handleRegenerateRecoveryCodes = async () => {
    setGeneratingCodes(true);
    setError('');

    try {
      const res = await csrfFetch('/api/auth/recovery-codes/regenerate', { method: 'POST' });
      const data = await res.json() as { codes?: string[]; error?: string };
      if (!res.ok) {
        setError(data.error || 'Unable to generate recovery codes.');
        return;
      }
      setRecoveryCodes(Array.isArray(data.codes) ? data.codes : []);
    } catch {
      setError('Unable to generate recovery codes.');
    } finally {
      setGeneratingCodes(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-midnight text-white/60 flex items-center justify-center">Loading security settings...</div>;
  }

  return (
    <div className="min-h-screen bg-midnight px-4 py-10">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Security</h1>
            <p className="text-white/60 mt-1">Manage passkeys and recovery codes.</p>
          </div>
          <Link href="/dashboard" className="text-sm text-white/60 hover:text-white/80">← Back to dashboard</Link>
        </div>

        {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

        <section className="bg-midnight-light border border-white/10 rounded-2xl p-6 mb-6">
          <h2 className="text-white text-xl font-semibold mb-2">Passkeys</h2>
          <p className="text-white/50 text-sm mb-4">Use passkeys for fast sign-in without entering your password.</p>

          <button
            onClick={handleAddPasskey}
            disabled={registeringPasskey}
            className="rounded-lg bg-accent-blue px-5 py-2.5 font-semibold text-white hover:bg-accent-glow transition-all disabled:opacity-50"
          >
            {registeringPasskey ? 'Waiting for device...' : 'Add Passkey'}
          </button>

          <div className="mt-5 space-y-3">
            {credentials.length === 0 ? (
              <p className="text-white/40 text-sm">No passkeys registered yet.</p>
            ) : (
              credentials.map((c) => (
                <div key={c.id} className="flex items-center justify-between bg-midnight border border-white/10 rounded-lg px-4 py-3">
                  <div>
                    <p className="text-white text-sm font-medium">{c.label}</p>
                    <p className="text-white/40 text-xs">Added {new Date(c.createdAt).toLocaleString()}</p>
                  </div>
                  <button onClick={() => handleDeletePasskey(c.id)} className="text-xs text-red-300 hover:text-red-200">Remove</button>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="bg-midnight-light border border-white/10 rounded-2xl p-6">
          <h2 className="text-white text-xl font-semibold mb-2">Recovery Codes</h2>
          <p className="text-white/50 text-sm mb-4">Generate one-time recovery codes for password reset when passkeys are unavailable.</p>

          <button
            onClick={handleRegenerateRecoveryCodes}
            disabled={generatingCodes}
            className="rounded-lg bg-white/10 px-5 py-2.5 font-semibold text-white hover:bg-white/20 transition-all disabled:opacity-50"
          >
            {generatingCodes ? 'Generating...' : 'Regenerate Recovery Codes'}
          </button>

          {recoveryCodes.length > 0 && (
            <div className="mt-5 bg-midnight border border-amber-500/30 rounded-lg p-4">
              <p className="text-amber-200 text-sm mb-3">Save these codes now. They are shown only once.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {recoveryCodes.map((code) => (
                  <code key={code} className="bg-black/30 text-amber-100 px-3 py-2 rounded text-sm">{code}</code>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
