import { NextRequest, NextResponse } from 'next/server';
import { getDb, getRuntimeEnv, getStripeSecrets } from '@/lib/env';
import { retrieveCheckoutSession } from '@/lib/stripe-api';

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('session_id');
  if (!sessionId) {
    return NextResponse.json({ error: 'session_id required' }, { status: 400 });
  }

  const env: any = getRuntimeEnv(request);
  const db = getDb(env);
  const MOCK_STRIPE = env?.MOCK_STRIPE === '1' || env?.E2E_TEST_MODE === '1';

  if (MOCK_STRIPE && sessionId.startsWith('mock_monthly_')) {
    const subscriber = await db.prepare('SELECT id, email FROM subscribers WHERE stripe_customer_id = ?').get(sessionId) as any;
    if (!subscriber) {
      return NextResponse.json({ mode: 'subscription', subscriberToken: null, customerEmail: null });
    }

    const tokenRec = await db.prepare(
      'SELECT token FROM subscriber_tokens WHERE subscriber_id = ? ORDER BY created_at DESC LIMIT 1'
    ).get(subscriber.id) as any;

    return NextResponse.json({
      mode: 'subscription',
      customerEmail: subscriber.email,
      subscriberToken: tokenRec?.token || null,
    });
  }

  const stripeSecrets = getStripeSecrets(request as any);
  if (!stripeSecrets) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
  }

  try {
    const session = await retrieveCheckoutSession(sessionId, stripeSecrets.STRIPE_SECRET_KEY);
    const result: Record<string, any> = {
      mode: session.mode,
      scanId: session.metadata?.scanId || null,
      url: session.metadata?.url || null,
      customerEmail: session.customer_email || null,
    };

    if (session.mode === 'subscription' && session.customer) {
      const subscriber = await db.prepare('SELECT id, email FROM subscribers WHERE stripe_customer_id = ?').get(session.customer as string) as any;
      if (subscriber) {
        const tokenRec = await db.prepare(
          'SELECT token FROM subscriber_tokens WHERE subscriber_id = ? ORDER BY created_at DESC LIMIT 1'
        ).get(subscriber.id) as any;
        result.subscriberToken = tokenRec?.token || null;
        result.customerEmail = subscriber.email || result.customerEmail;
      }
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Stripe session lookup error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
