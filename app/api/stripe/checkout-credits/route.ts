import { NextRequest, NextResponse } from 'next/server';
import { getDb, getRuntimeEnv, getStripeSecrets } from '@/lib/env';
import { getBearerToken, getUserSession, touchUserSession } from '@/lib/auth';

type Pack = 'credits_3' | 'credits_10';

function packToCredits(pack: Pack): number {
  return pack === 'credits_10' ? 10 : 3;
}

export async function POST(request: NextRequest) {
  try {
    const token = getBearerToken(request) || request.cookies.get('session_token')?.value || request.cookies.get('session')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { pack } = await request.json() as { pack?: Pack };
    if (pack !== 'credits_3' && pack !== 'credits_10') {
      return NextResponse.json({ error: 'Invalid pack' }, { status: 400 });
    }

    const env: any = getRuntimeEnv((request as any).env ?? (globalThis as any).__env ?? undefined);
    const db = getDb(env);

    const session = await getUserSession(db, token);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await touchUserSession(db, token);

    const appUrl = env?.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://complyscan.pages.dev';
    const MOCK_STRIPE = env?.MOCK_STRIPE === '1' || process.env?.MOCK_STRIPE === '1';

    if (MOCK_STRIPE) {
      const credits = packToCredits(pack);
      await db.prepare(`UPDATE users SET credits = credits + ? WHERE id = ?`).run(credits, session.user_id);
      return NextResponse.json({ url: `${appUrl}/dashboard?token=${encodeURIComponent(token)}&credits_added=${credits}` });
    }

    const stripeSecrets = getStripeSecrets(request as any);
    if (!stripeSecrets) return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });

    const priceId =
      pack === 'credits_3'
        ? stripeSecrets.STRIPE_PRICE_CREDITS_3?.trim()
        : stripeSecrets.STRIPE_PRICE_CREDITS_10?.trim();

    if (!priceId) return NextResponse.json({ error: 'Credit pack price not configured' }, { status: 500 });

    const credits = packToCredits(pack);

    const params = new URLSearchParams();
    params.append('mode', 'payment');
    params.append('line_items[0][price]', priceId);
    params.append('line_items[0][quantity]', '1');
    params.append('success_url', `${appUrl}/dashboard?token=${encodeURIComponent(token)}&credits_added=${credits}`);
    params.append('cancel_url', `${appUrl}/dashboard?token=${encodeURIComponent(token)}&cancelled=true`);
    params.append('customer_email', session.email);
    params.append('metadata[purchaseType]', 'credits');
    params.append('metadata[userId]', String(session.user_id));
    params.append('metadata[credits]', String(credits));

    const resp = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeSecrets.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const sessionData = await resp.json() as { url?: string; error?: { message?: string } };
    if (!resp.ok || !sessionData.url) {
      return NextResponse.json({ error: sessionData.error?.message || `Stripe error: ${resp.status}` }, { status: 500 });
    }

    return NextResponse.json({ url: sessionData.url });
  } catch (err: any) {
    console.error('Credits checkout error:', err?.message || err);
    return NextResponse.json({ error: err?.message || 'Checkout failed' }, { status: 500 });
  }
}

