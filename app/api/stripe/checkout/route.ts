import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { getDb, getRuntimeEnv, getStripeSecrets } from '@/lib/env';
import { buildSubscriptionSuccessUrl } from '@/lib/stripe-success-url';

export async function POST(request: NextRequest) {
  try {
    const { url: websiteUrl, email, plan, scanId: existingScanId } = await request.json() as {
      url?: string;
      email?: string;
      plan?: 'monthly' | 'agency';
      scanId?: string;
    };

    const normalizedPlan = plan === 'agency' ? 'monthly' : plan;
    const requiresUrl = normalizedPlan !== 'monthly';

    if (requiresUrl && !websiteUrl) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    const runtimeEnv: any = getRuntimeEnv((request as any).env ?? (globalThis as any).__env ?? undefined);
    const appUrl = runtimeEnv?.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://complyscan.pages.dev';
    const scanId = existingScanId || uuidv4();
    const MOCK_STRIPE =
      runtimeEnv?.MOCK_STRIPE === '1' ||
      process.env?.MOCK_STRIPE === '1';

    if (MOCK_STRIPE) {
      const db = getDb(runtimeEnv);
      const sessionId = `mock_monthly_${scanId}`;
      const subscriberId = uuidv4();
      const token = crypto.randomBytes(24).toString('hex');
      const customerEmail = email || 'agency-e2e@example.com';

      await db.prepare(`
        INSERT OR REPLACE INTO subscribers (id, stripe_customer_id, email, plan, status, current_period_end, cancel_at_period_end, updated_at)
        VALUES (?, ?, ?, 'agency', 'active', ?, 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
      `).run(subscriberId, sessionId, customerEmail, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString());

      await db.prepare('DELETE FROM subscriber_tokens WHERE subscriber_id = ?').run(subscriberId);
      await db.prepare(`
        INSERT INTO subscriber_tokens (token, subscriber_id, created_at, last_used_at)
        VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
      `).run(token, subscriberId);

      return NextResponse.json({
        url: `${appUrl}/success?session_id=${encodeURIComponent(sessionId)}&plan=monthly&email=${encodeURIComponent(customerEmail)}`,
        sessionId,
        scanId: null,
      });
    }

    const stripeSecrets = getStripeSecrets(request as any);
    if (!stripeSecrets) {
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
    }

    const priceId = stripeSecrets.STRIPE_PRICE_MONTHLY?.trim();
    if (!priceId) {
      return NextResponse.json({ error: 'Monthly price not configured' }, { status: 500 });
    }

    const params = new URLSearchParams();
    params.append('mode', 'subscription');
    params.append('line_items[0][price]', priceId);
    params.append('line_items[0][quantity]', '1');
    if (email) params.append('customer_email', email);

    const successUrl = buildSubscriptionSuccessUrl(appUrl, scanId, websiteUrl, email);
    params.append('success_url', successUrl);
    params.append('cancel_url', `${appUrl}/?cancelled=true`);
    params.append('metadata[scanId]', scanId);
    params.append('metadata[url]', websiteUrl || '');
    params.append('metadata[plan]', 'monthly');

    const customerResp = await fetch('https://api.stripe.com/v1/customers', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeSecrets.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ email: email || '' }).toString(),
    });
    const customer = await customerResp.json() as { id?: string; error?: { message?: string } };
    if (!customerResp.ok || !customer.id) {
      return NextResponse.json({ error: customer.error?.message || 'Customer creation failed' }, { status: 500 });
    }
    params.append('customer', customer.id);
    params.delete('customer_email');
    params.append('subscription_data[metadata][plan]', 'agency');
    params.append('subscription_data[metadata][scanId]', scanId);
    params.append('subscription_data[metadata][url]', websiteUrl || '');

    const resp = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeSecrets.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const sessionData = await resp.json() as { url?: string; id?: string; error?: { message?: string } };
    if (!resp.ok) {
      return NextResponse.json({ error: sessionData.error?.message || `Stripe error: ${resp.status}` }, { status: 500 });
    }

    return NextResponse.json({ url: sessionData.url, sessionId: sessionData.id, scanId });
  } catch (err: any) {
    console.error('Checkout error:', err?.message || err);
    return NextResponse.json({ error: err?.message || 'Checkout failed' }, { status: 500 });
  }
}




