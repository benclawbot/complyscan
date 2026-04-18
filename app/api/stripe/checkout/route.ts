import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb, getRuntimeEnv, getStripeSecrets } from '@/lib/env';
import { buildSubscriptionSuccessUrl } from '@/lib/stripe-success-url';
import { requireUserSession } from '@/lib/auth';
import { hasValidCsrf, csrfErrorResponse } from '@/lib/csrf';

export async function POST(request: NextRequest) {
  if (!hasValidCsrf(request as any)) {
    return csrfErrorResponse();
  }

  try {
    const { url: websiteUrl, plan, scanId: existingScanId } = await request.json() as {
      url?: string;
      plan?: 'monthly' | 'agency';
      scanId?: string;
    };

    const normalizedPlan = plan === 'agency' ? 'monthly' : plan;
    const requiresUrl = normalizedPlan !== 'monthly';

    if (requiresUrl && !websiteUrl) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    const runtimeEnv: any = getRuntimeEnv((request as any).env ?? (globalThis as any).__env ?? undefined);
    const db = getDb(runtimeEnv);
    const auth = await requireUserSession(request as any, db);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const appUrl = runtimeEnv?.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://complyscan.pages.dev';
    const scanId = existingScanId || uuidv4();
    const MOCK_STRIPE = runtimeEnv?.MOCK_STRIPE === '1' || process.env?.MOCK_STRIPE === '1';

    if (MOCK_STRIPE) {
      const sessionId = `mock_monthly_${scanId}`;
      const subscriberId = uuidv4();

      await db.prepare(`
        INSERT OR REPLACE INTO subscribers (id, user_id, stripe_customer_id, email, plan, status, current_period_end, cancel_at_period_end, updated_at)
        VALUES (?, ?, ?, ?, 'agency', 'active', ?, 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
      `).run(subscriberId, auth.session.user_id, sessionId, auth.session.email, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString());

      return NextResponse.json({
        url: `${appUrl}/success?session_id=${encodeURIComponent(sessionId)}&plan=monthly`,
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
    params.append('customer_email', auth.session.email);

    const successUrl = buildSubscriptionSuccessUrl(appUrl, scanId, websiteUrl, auth.session.email);
    params.append('success_url', successUrl);
    params.append('cancel_url', `${appUrl}/dashboard?cancelled=true`);
    params.append('metadata[scanId]', scanId);
    params.append('metadata[url]', websiteUrl || '');
    params.append('metadata[plan]', 'monthly');
    params.append('metadata[userId]', auth.session.user_id);

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
