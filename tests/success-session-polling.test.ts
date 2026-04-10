import { describe, expect, it } from 'vitest';
import { shouldContinuePollingForSubscriberToken } from '@/app/success/polling';

describe('success session polling', () => {
  it('continues polling when customer email exists but subscriber token is still missing', () => {
    const shouldContinue = shouldContinuePollingForSubscriberToken({
      customerEmail: 'payer@example.com',
      subscriberToken: null,
    });

    expect(shouldContinue).toBe(true);
  });

  it('stops polling once subscriber token is present', () => {
    const shouldContinue = shouldContinuePollingForSubscriberToken({
      customerEmail: 'payer@example.com',
      subscriberToken: 'tok_123',
    });

    expect(shouldContinue).toBe(false);
  });
});
