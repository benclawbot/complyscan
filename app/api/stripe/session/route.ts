import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb, getRuntimeEnv, getStripeSecrets } from '@/lib/env';
import { retrieveCheckoutSession, retrieveSubscription } from '@/lib/stripe-api';

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('session_id');
  if (!sessionId) {
    return NextResponse.json({ error: 'session_id required' }, { status: 400 });
  }

  const env: any = getRuntimeEnv((request as any).env ?? (globalThis as any).__env ?? undefined);
  const db = getDb(env);
  const MOCK_STRIPE = env?.MOCK_STRIPE === '1' || process.env?.MOCK_STRIPE === '1';

  if (MOCK_STRIPE && sessionId.startsWith('mock_monthly_')) {
    const subscriber = await db.prepare('SELECT id, email, user_id FROM subscribers WHERE stripe_customer_id = ?').get(sessionId) as any;
    return NextResponse.json({
      mode: 'subscription',
      subscriptionReady: Boolean(subscriber?.id && subscriber?.user_id),
      customerEmail: subscriber?.email || null,
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
      const stripeCustomerId = String(session.customer || '').trim();
      const sessionCustomerEmail = String(session.customer_email || session.customer_details?.email || '').trim();
      const subscriptionIsComplete = String(session.status || '') === 'complete';
      const userId = String(session.metadata?.userId || '').trim();

      let periodEndIso: string | null = null;
      let cancelAtPeriodEnd = false;
      const stripeSubscriptionId = String(session.subscription || '').trim();
      if (stripeSubscriptionId) {
        try {
          const sub = await retrieveSubscription(stripeSubscriptionId, stripeSecrets.STRIPE_SECRET_KEY);
          periodEndIso = sub?.current_period_end ? new Date(Number(sub.current_period_end) * 1000).toISOString() : null;
          cancelAtPeriodEnd = Boolean(sub?.cancel_at_period_end);
        } catch {
          // ignore subscription lookup failures
        }
      }

      if (subscriptionIsComplete && stripeCustomerId && userId) {
        let subscriber = await db.prepare('SELECT id FROM subscribers WHERE user_id = ?').get(userId) as any;
        if (!subscriber) {
          subscriber = await db.prepare('SELECT id FROM subscribers WHERE stripe_customer_id = ?').get(stripeCustomerId) as any;
        }

        if (!subscriber) {
          const subscriberId = uuidv4();
          await db.prepare(`
            INSERT INTO subscribers (id, user_id, stripe_customer_id, email, plan, status, current_period_end, cancel_at_period_end, updated_at)
            VALUES (?, ?, ?, ?, 'agency', 'active', ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
          `).run(subscriberId, userId, stripeCustomerId, sessionCustomerEmail, periodEndIso, cancelAtPeriodEnd ? 1 : 0);
        } else {
          await db.prepare(`
            UPDATE subscribers
            SET user_id = ?, stripe_customer_id = ?, email = COALESCE(?, email), plan = 'agency', status = 'active',
                current_period_end = COALESCE(?, current_period_end), cancel_at_period_end = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
            WHERE id = ?
          `).run(userId, stripeCustomerId, sessionCustomerEmail, periodEndIso, cancelAtPeriodEnd ? 1 : 0, subscriber.id);
        }
      }

      result.subscriptionReady = Boolean(subscriptionIsComplete && userId);
    } else if (session.mode === 'payment' && String(session.metadata?.purchaseType || '') === 'credits') {
      const userId = String(session.metadata?.userId || '').trim();
      const credits = Number(session.metadata?.credits || 0);
      const paymentComplete = String(session.status || '') === 'complete' || String(session.payment_status || '') === 'paid';
      const markerScanId = `credits:${session.id}`;

      result.purchaseType = 'credits';
      result.creditsRequested = Number.isFinite(credits) ? credits : 0;

      if (paymentComplete && userId && Number.isFinite(credits) && credits > 0) {
        const alreadyApplied = await db.prepare('SELECT id FROM report_purchases WHERE scan_id = ?').get(markerScanId) as any;
        if (!alreadyApplied) {
          const user = await db.prepare('SELECT id FROM users WHERE id = ?').get(userId) as any;
          if (user) {
            await db.prepare('UPDATE users SET credits = credits + ? WHERE id = ?').run(credits, userId);
            await db.prepare(`
              INSERT INTO report_purchases (id, scan_id, user_id, stripe_payment_intent, purchased_at)
              VALUES (?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
            `).run(`purchase_${session.id}`, markerScanId, userId, session.payment_intent || null);
            result.creditsApplied = credits;
          } else {
            result.creditsApplied = 0;
            result.error = 'User not found for credit purchase';
          }
        } else {
          result.creditsApplied = 0;
        }

        const updatedUser = await db.prepare('SELECT credits FROM users WHERE id = ?').get(userId) as any;
        result.currentCredits = Number(updatedUser?.credits || 0);
      }
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Stripe session lookup error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
