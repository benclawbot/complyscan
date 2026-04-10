"use client";

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function SuccessClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const plan = searchParams.get('plan');
  const email = searchParams.get('email');

  const [subscriberToken, setSubscriberToken] = useState<string | null>(null);
  const [customerEmail, setCustomerEmail] = useState<string | null>(email);

  useEffect(() => {
    if (!sessionId || plan !== 'monthly') return;

    // Poll for the subscriber token — in real Stripe mode the webhook fires asynchronously
    let attempts = 0;
    const poll = () => {
      fetch(`/api/stripe/session?session_id=${encodeURIComponent(sessionId)}`)
        .then(async (res) => {
          if (!res.ok) return { subscriberToken: null, customerEmail: null };
          return await res.json() as { subscriberToken?: string; customerEmail?: string };
        })
        .then((data) => {
          if (data?.subscriberToken) {
            setSubscriberToken(data.subscriberToken);
            document.cookie = `session_token=${encodeURIComponent(data.subscriberToken)}; path=/; SameSite=Lax`;
            router.replace(`/dashboard?token=${encodeURIComponent(data.subscriberToken)}`);
            return;
          } else if (data?.customerEmail) {
            setCustomerEmail(data.customerEmail);
          } else if (attempts < 80) {
            attempts += 1;
            setTimeout(poll, 1500);
          }
        })
        .catch(() => {
          if (attempts < 80) {
            attempts += 1;
            setTimeout(poll, 1500);
          }
        });
    };
    poll();
  }, [sessionId, plan, router]);

  if (plan === 'monthly') {
    const dashboardUrl = subscriberToken ? `/dashboard?token=${encodeURIComponent(subscriberToken)}` : '/dashboard';
    return (
      <div className="min-h-screen bg-midnight flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 bg-success/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-success" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Subscription Active!</h1>
          <p className="text-white/60 mb-2">Your agency subscription is confirmed.</p>
          {customerEmail && <p className="text-white/40 text-sm mb-6">{customerEmail}</p>}
          {subscriberToken ? (
            <>
              <p className="text-white/60 text-sm mb-4">Save your dashboard access token:</p>
              <div className="bg-white/5 border border-white/10 rounded-lg p-3 mb-6 text-left">
                <code className="text-accent-blue text-xs break-all">{subscriberToken}</code>
              </div>
              <a href={dashboardUrl} className="inline-block px-6 py-3 bg-accent-blue text-white rounded-lg font-medium hover:bg-accent-blue/90 transition-all">
                Go to Dashboard
              </a>
            </>
          ) : (
            <p className="text-white/40 text-sm mb-6">Preparing your dashboard access…</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-midnight flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-white/60" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Unknown Session</h1>
        <p className="text-white/60 mb-8">This payment session is not recognised.</p>
        <a href="/" className="inline-block px-6 py-3 bg-accent-blue text-white rounded-lg font-medium hover:bg-accent-blue/90 transition-all">Go Home</a>
      </div>
    </div>
  );
}





