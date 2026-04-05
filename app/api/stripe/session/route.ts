import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/env';
import { retrieveCheckoutSession } from '@/lib/stripe-api';

const MOCK_STRIPE = process.env.MOCK_STRIPE === '1' || process.env.E2E_TEST_MODE === '1';

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('session_id');
  if (!sessionId) {
    return NextResponse.json({ error: 'session_id required' }, { status: 400 });
  }

  const env: any = (request as any).env ?? (globalThis as any).__env ?? undefined;
  const db = getDb(env);

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

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
  }

  try {
    const session = await retrieveCheckoutSession(sessionId);
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
