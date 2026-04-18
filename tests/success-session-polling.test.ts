import { describe, expect, it } from 'vitest';
import { shouldContinuePollingForSubscription } from '@/app/success/polling';

describe('success session polling', () => {
  it('continues polling while subscription is not ready', () => {
    const shouldContinue = shouldContinuePollingForSubscription({
      customerEmail: 'payer@example.com',
      subscriptionReady: false,
    });

    expect(shouldContinue).toBe(true);
  });

  it('stops polling once subscription is ready', () => {
    const shouldContinue = shouldContinuePollingForSubscription({
      customerEmail: 'payer@example.com',
      subscriptionReady: true,
    });

    expect(shouldContinue).toBe(false);
  });
});
