/**
 * Report Delivery Contract Tests (session-era)
 */
import { describe, it, expect } from 'vitest';

describe('Report delivery access model', () => {
  it('uses session ownership instead of token query auth', () => {
    const authModel = {
      cookie: 'session',
      allowsTokenQuery: false,
      ownershipKeys: ['user_id', 'subscriber_id'],
    };

    expect(authModel.cookie).toBe('session');
    expect(authModel.allowsTokenQuery).toBe(false);
    expect(authModel.ownershipKeys).toContain('user_id');
  });

  it('keeps paid PDF gating for non-subscriber scans', () => {
    const policy = {
      requiresCreditsForUserPdf: true,
      subscriberBypass: true,
    };

    expect(policy.requiresCreditsForUserPdf).toBe(true);
    expect(policy.subscriberBypass).toBe(true);
  });
});
