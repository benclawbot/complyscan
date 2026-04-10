import { NextRequest, NextResponse } from 'next/server';
import { getDb, getRuntimeEnv, getStripeSecrets } from '@/lib/env';
import { getBearerToken, verifySubscriberToken, touchSubscriberToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const token =
      getBearerToken(request) ||
      request.cookies.get('session_token')?.value ||
      request.cookies.get('session')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const env: any = getRuntimeEnv((request as any).env ?? (globalThis as any).__env ?? undefined);
    const db = getDb(env);

    const subscriber = await verifySubscriberToken(db, token, 'agency');
    if (!subscriber) {
      return NextResponse.json({ error: 'Subscriber access required' }, { status: 403 });
    }

    await touchSubscriberToken(db, token);

    const subRow = await db
      .prepare('SELECT stripe_customer_id FROM subscribers WHERE id = ?')
      .get(subscriber.subscriber_id) as any;

    const stripeCustomerId = String(subRow?.stripe_customer_id || '').trim();
    if (!stripeCustomerId) {
      return NextResponse.json({ error: 'Missing Stripe customer' }, { status: 400 });
    }

    const stripeSecrets = getStripeSecrets(request as any);
    if (!stripeSecrets) {
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
    }

    const appUrl =
      env?.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'https://complyscan.pages.dev';

    const params = new URLSearchParams();
    params.append('customer', stripeCustomerId);
    params.append('return_url', `${appUrl}/dashboard?token=${encodeURIComponent(token)}`);

    const resp = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeSecrets.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const data = await resp.json() as { url?: string; error?: { message?: string } };
    if (!resp.ok || !data.url) {
      return NextResponse.json(
        { error: data.error?.message || `Stripe error: ${resp.status}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: data.url });
  } catch (err: any) {
    console.error('Billing portal error:', err?.message || err);
    return NextResponse.json({ error: err?.message || 'Unable to open billing portal' }, { status: 500 });
  }
}
