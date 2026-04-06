import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { getDb, getRuntimeEnv, getStripeSecrets } from '@/lib/env';
import { retrieveSubscription, verifyStripeWebhookSignature } from '@/lib/stripe-api';

export async function POST(request: NextRequest) {
  try {
    const env: any = getRuntimeEnv(request);
    const stripeSecrets = getStripeSecrets(request as any);
    if (!stripeSecrets || !stripeSecrets.STRIPE_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
    }

    const body = await request.text();
    const signature = request.headers.get('stripe-signature');
    const webhookSecret = stripeSecrets.STRIPE_WEBHOOK_SECRET;

    if (!signature || !webhookSecret) {
      return NextResponse.json({ error: 'Missing signature or webhook secret' }, { status: 400 });
    }

    if (!verifyStripeWebhookSignature(body, signature, webhookSecret)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const event = JSON.parse(body) as any;
    const db = getDb(env);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as any;
        const scanId = session.metadata?.scanId || uuidv4();
        const websiteUrl = session.metadata?.url || '';
        const customerEmail = session.customer_email || null;

        if (session.mode === 'payment') {
          const existing = await db.prepare('SELECT id FROM scans WHERE id = ?').get(scanId) as any;
          if (existing) {
            await db.prepare(`
              UPDATE scans
              SET stripe_session_id = ?, email = COALESCE(?, email)
              WHERE id = ?
            `).run(session.id, customerEmail, scanId);
          } else {
            await db.prepare(`
              INSERT INTO scans (id, url, status, email, stripe_session_id, created_at)
              VALUES (?, ?, 'pending', ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
            `).run(scanId, websiteUrl, customerEmail, session.id);
          }
        } else if (session.mode === 'subscription') {
          const customerId = String(session.customer || '');
          const customerEmailValue = session.customer_email ?? '';

          let periodEnd: string | null = null;
          let cancelAtPeriodEnd = false;
          try {
            const subscription = await retrieveSubscription(String(session.subscription), stripeSecrets.STRIPE_SECRET_KEY);
            periodEnd = subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null;
            cancelAtPeriodEnd = Boolean(subscription.cancel_at_period_end);
          } catch {
            // ignore
          }

          const existingSub = await db.prepare('SELECT id FROM subscribers WHERE stripe_customer_id = ?').get(customerId) as any;
          const subscriberId = existingSub?.id || uuidv4();

          if (!existingSub) {
            await db.prepare(`
              INSERT INTO subscribers (id, stripe_customer_id, email, plan, status, current_period_end, cancel_at_period_end, updated_at)
              VALUES (?, ?, ?, 'agency', 'active', ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
            `).run(subscriberId, customerId, customerEmailValue, periodEnd, cancelAtPeriodEnd ? 1 : 0);
          } else {
            await db.prepare(`
              UPDATE subscribers
              SET email = ?, plan = 'agency', status = 'active', current_period_end = COALESCE(?, current_period_end),
                  cancel_at_period_end = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
              WHERE id = ?
            `).run(customerEmailValue, periodEnd, cancelAtPeriodEnd ? 1 : 0, subscriberId);
          }

          const token = crypto.randomBytes(24).toString('hex');
          await db.prepare('DELETE FROM subscriber_tokens WHERE subscriber_id = ?').run(subscriberId);
          await db.prepare(`
            INSERT INTO subscriber_tokens (token, subscriber_id, created_at, last_used_at)
            VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
          `).run(token, subscriberId);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as any;
        const customerId = String(subscription.customer);
        const subAny = subscription as any;
        const periodEnd = subAny.current_period_end ? new Date(subAny.current_period_end * 1000).toISOString() : null;
        const cancelAtPeriodEnd = subAny.cancel_at_period_end ? 1 : 0;
        const status = subscription.status === 'active' ? 'active' : subscription.status;

        await db.prepare(`
          UPDATE subscribers
          SET status = ?, current_period_end = COALESCE(?, current_period_end), cancel_at_period_end = ?,
              updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
          WHERE stripe_customer_id = ?
        `).run(status, periodEnd, cancelAtPeriodEnd, customerId);

        const sub = await db.prepare('SELECT id FROM subscribers WHERE stripe_customer_id = ?').get(customerId) as any;
        if (sub) {
          if (status === 'active') {
            await db.prepare('UPDATE subscriber_tokens SET expires_at = NULL WHERE subscriber_id = ?').run(sub.id);
          } else if (periodEnd) {
            await db.prepare('UPDATE subscriber_tokens SET expires_at = ? WHERE subscriber_id = ?').run(periodEnd, sub.id);
          }
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as any;
        const invoiceAny = invoice as any;
        const customerId = String(invoiceAny.customer || '');
        if (invoiceAny.subscription) {
          try {
            const subscription = await retrieveSubscription(String(invoiceAny.subscription), stripeSecrets.STRIPE_SECRET_KEY);
            const periodEnd = subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null;
            await db.prepare(`
              UPDATE subscribers
              SET status = 'active', plan = 'agency', current_period_end = COALESCE(?, current_period_end),
                  cancel_at_period_end = 0, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
              WHERE stripe_customer_id = ?
            `).run(periodEnd, customerId);

            const sub = await db.prepare('SELECT id FROM subscribers WHERE stripe_customer_id = ?').get(customerId) as any;
            if (sub) {
              await db.prepare('UPDATE subscriber_tokens SET expires_at = NULL WHERE subscriber_id = ?').run(sub.id);
            }
          } catch {
            // ignore
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as any;
        const customerId = String(subscription.customer);
        const sub = await db.prepare('SELECT id FROM subscribers WHERE stripe_customer_id = ?').get(customerId) as any;
        if (sub) {
          await db.prepare(`
            UPDATE subscribers SET status = 'cancelled', updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
            WHERE stripe_customer_id = ?
          `).run(customerId);
          await db.prepare(`
            UPDATE subscriber_tokens SET expires_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE subscriber_id = ?
          `).run(sub.id);
        }
        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error('Webhook handler error:', err.message, err?.stack);
    return NextResponse.json({ error: 'Internal error', detail: err.message }, { status: 500 });
  }
}
