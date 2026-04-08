import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { getDb, getRuntimeEnv, getStripeSecrets } from '@/lib/env';
import { retrieveCheckoutSession } from '@/lib/stripe-api';

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('session_id');
  if (!sessionId) {
    return NextResponse.json({ error: 'session_id required' }, { status: 400 });
  }

  const env: any = getRuntimeEnv((request as any).env ?? (globalThis as any).__env ?? undefined);
  const db = getDb(env);
  const MOCK_STRIPE = env?.MOCK_STRIPE === '1' || process.env?.MOCK_STRIPE === '1';

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

    if (session.mode === 'subscription') {
      const stripeCustomerId = String(session.customer || '');
      const sessionCustomerEmail = String(session.customer_email || '').trim();
      const subscriptionIsComplete = String(session.status || '') === 'complete';

      if (stripeCustomerId) {
        let subscriber = await db.prepare('SELECT id, email FROM subscribers WHERE stripe_customer_id = ?').get(stripeCustomerId) as any;

        // Self-heal path: if webhook is delayed/missed, bootstrap subscriber + token from a completed checkout session.
        if (!subscriber && subscriptionIsComplete && sessionCustomerEmail) {
          const subscriberId = uuidv4();
          await db.prepare(`
            INSERT INTO subscribers (id, stripe_customer_id, email, plan, status, current_period_end, cancel_at_period_end, updated_at)
            VALUES (?, ?, ?, 'agency', 'active', NULL, 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
          `).run(subscriberId, stripeCustomerId, sessionCustomerEmail);

          const token = crypto.randomBytes(24).toString('hex');
          await db.prepare(`
            INSERT INTO subscriber_tokens (token, subscriber_id, created_at, last_used_at)
            VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
          `).run(token, subscriberId);

          subscriber = { id: subscriberId, email: sessionCustomerEmail };
          result.subscriberToken = token;
          result.customerEmail = sessionCustomerEmail;
        }

        if (subscriber && !result.subscriberToken) {
          const tokenRec = await db.prepare(
            'SELECT token FROM subscriber_tokens WHERE subscriber_id = ? ORDER BY created_at DESC LIMIT 1'
          ).get(subscriber.id) as any;

          if (tokenRec?.token) {
            result.subscriberToken = tokenRec.token;
          } else if (subscriptionIsComplete) {
            const token = crypto.randomBytes(24).toString('hex');
            await db.prepare(`
              INSERT INTO subscriber_tokens (token, subscriber_id, created_at, last_used_at)
              VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
            `).run(token, subscriber.id);
            result.subscriberToken = token;
          }

          result.customerEmail = subscriber.email || result.customerEmail;
        }
      }
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Stripe session lookup error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}



