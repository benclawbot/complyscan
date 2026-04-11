import { describe, expect, it } from 'vitest';
import { buildSubscriptionSuccessUrl } from '@/lib/stripe-success-url';

describe('buildSubscriptionSuccessUrl', () => {
  it('keeps Stripe CHECKOUT_SESSION_ID placeholder unescaped for Stripe substitution', () => {
    const url = buildSubscriptionSuccessUrl(
      'https://complyscan.pages.dev',
      'scan_123',
      'https://example.com',
      'thomas.chaffanjon@gmail.com',
    );

    expect(url).toContain('session_id={CHECKOUT_SESSION_ID}');
    expect(url).not.toContain('%7BCHECKOUT_SESSION_ID%7D');

    const params = new URLSearchParams();
    params.append('success_url', url);

    const encoded = params.toString();
    const decodedOnce = decodeURIComponent(encoded.replace(/^success_url=/, ''));

    expect(decodedOnce).toContain('session_id={CHECKOUT_SESSION_ID}');
    expect(decodedOnce).not.toContain('session_id=%7BCHECKOUT_SESSION_ID%7D');
  });
});

