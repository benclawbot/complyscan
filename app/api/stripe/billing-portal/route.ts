import { NextRequest, NextResponse } from 'next/server';
import { getDb, getRuntimeEnv, getStripeSecrets } from '@/lib/env';
import { requireAgencySession } from '@/lib/auth';
import { hasValidCsrf, csrfErrorResponse } from '@/lib/csrf';

export async function POST(request: NextRequest) {
  if (!hasValidCsrf(request as any)) {
    return csrfErrorResponse();
  }

  try {
    const env: any = getRuntimeEnv((request as any).env ?? (globalThis as any).__env ?? undefined);
    const db = getDb(env);
    const auth = await requireAgencySession(request as any, db);

    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const customer = await db
      .prepare('SELECT stripe_customer_id FROM subscribers WHERE id = ?')
      .get(auth.subscriber.id) as any;

    if (!customer?.stripe_customer_id) {
      return NextResponse.json({ error: 'No Stripe customer found for your account.' }, { status: 404 });
    }

    const stripeSecrets = getStripeSecrets(request as any);
    if (!stripeSecrets) {
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
    }

    const appUrl = env?.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://complyscan.pages.dev';

    const params = new URLSearchParams();
    params.append('customer', String(customer.stripe_customer_id));
    params.append('return_url', `${appUrl}/dashboard`);

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
      return NextResponse.json({ error: data.error?.message || 'Unable to create billing portal session' }, { status: 500 });
    }

    return NextResponse.json({ url: data.url });
  } catch (error: any) {
    console.error('Billing portal error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
