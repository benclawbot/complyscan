import crypto from 'crypto';

const STRIPE_API_BASE = 'https://api.stripe.com/v1';

function getStripeSecretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new Error('Stripe not configured');
  return key;
}

function resolveKey(providedKey?: string): string {
  return providedKey?.trim() || getStripeSecretKey();
}

async function stripeRequest(path: string, stripeKey?: string): Promise<any> {
  const key = resolveKey(stripeKey);
  const response = await fetch(`${STRIPE_API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  const data = await response.json() as any;
  if (!response.ok) {
    throw new Error(data?.error?.message || `Stripe API error: ${response.status}`);
  }
  return data;
}

export async function retrieveCheckoutSession(sessionId: string, stripeKey?: string): Promise<any> {
  return stripeRequest(`/checkout/sessions/${encodeURIComponent(sessionId)}`, stripeKey);
}

export async function retrieveSubscription(subscriptionId: string, stripeKey?: string): Promise<any> {
  return stripeRequest(`/subscriptions/${encodeURIComponent(subscriptionId)}`, stripeKey);
}

export function verifyStripeWebhookSignature(payload: string, signatureHeader: string, webhookSecret: string): boolean {
  const parts = Object.fromEntries(
    signatureHeader.split(',').map((part) => {
      const [key, value] = part.split('=', 2);
      return [key, value];
    })
  );

  const timestamp = parts.t;
  const expected = parts.v1;
  if (!timestamp || !expected) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const digest = crypto.createHmac('sha256', webhookSecret).update(signedPayload, 'utf8').digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(expected));
  } catch {
    return false;
  }
}
