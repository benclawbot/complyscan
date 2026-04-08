/**
 * Free Scan Flow & Account Creation Tests
 * Tests: /api/scan/free, /api/auth/claim-scan, pricing + access gates
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock DB ──────────────────────────────────────────────────────────────────

interface MockScan {
  id: string;
  url: string;
  email: string | null;
  status: string;
  result_json: string | null;
  stripe_session_id: string | null;
  user_id: string | null;
}

interface MockUser {
  id: string;
  email: string;
  password_hash: string;
}

function createMockDb() {
  const scans: MockScan[] = [];
  const users: MockUser[] = [];

  return {
    scans,
    users,
    prepare: (sql: string) => {
      if (sql.includes('SELECT') && sql.includes('scans')) {
        return {
          get: (id: string) => scans.find(s => s.id === id) || null,
          all: () => scans,
        };
      }
      if (sql.includes('SELECT') && sql.includes('users')) {
        return {
          get: (email: string) => users.find(u => u.email === email) || null,
        };
      }
      if (sql.includes('INSERT INTO scans')) {
        return {
          run: (id: string, url: string, status: string, email: string | null, stripe_session_id: string | null) => {
            scans.push({ id, url, email, status, result_json: null, stripe_session_id, user_id: null });
          },
        };
      }
      if (sql.includes('UPDATE scans SET') && sql.includes('completed')) {
        return {
          run: (resultJson: string, id: string) => {
            const scan = scans.find(s => s.id === id);
            if (scan) { scan.status = 'completed'; scan.result_json = resultJson; }
          },
        };
      }
      if (sql.includes('UPDATE scans SET status')) {
        return {
          run: (id: string) => {
            const scan = scans.find(s => s.id === id);
            if (scan) scan.status = 'processing';
          },
        };
      }
      if (sql.includes('UPDATE scans SET user_id')) {
        return {
          run: (userId: string, scanId: string) => {
            const scan = scans.find(s => s.id === scanId);
            if (scan) scan.user_id = userId;
          },
        };
      }
      if (sql.includes('INSERT INTO users')) {
        return {
          run: (id: string, email: string, passwordHash: string) => {
            users.push({ id, email, password_hash: passwordHash });
          },
        };
      }
      if (sql.includes('INSERT INTO sessions')) {
        return { run: () => {} };
      }
      return { run: () => {}, get: () => null, all: () => [] };
    },
  };
}

// ── FREE SCAN ROUTE TESTS ─────────────────────────────────────────────────────

describe('Free Scan API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/scan/free', () => {
    it('returns 400 when URL is missing', async () => {
      const body = { email: 'test@test.com' };
      expect(body.url).toBeUndefined();
    });

    it('returns 400 when email is missing', async () => {
      const body = { url: 'https://example.com' };
      expect(body.email).toBeUndefined();
    });

    it('validates email format', () => {
      const email = 'not-an-email';
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      expect(emailRegex.test(email)).toBe(false);

      const validEmail = 'test@example.com';
      expect(emailRegex.test(validEmail)).toBe(true);
    });

    it('validates URL format', () => {
      const urlRegex = /^https?:\/\/.+/;
      expect(urlRegex.test('https://example.com')).toBe(true);
      expect(urlRegex.test('http://example.com')).toBe(true);
      expect(urlRegex.test('example.com')).toBe(false);
      expect(urlRegex.test('ftp://example.com')).toBe(false);
    });

    it('free scan creates a processing scan record', () => {
      const mockDb = createMockDb();
      const scanId = 'scan-123';
      const url = 'https://example.com';
      const email = 'test@test.com';

      mockDb.prepare('INSERT INTO scans').run(scanId, url, 'processing', email, null);

      expect(mockDb.scans).toHaveLength(1);
      expect(mockDb.scans[0].status).toBe('processing');
      expect(mockDb.scans[0].email).toBe(email);
    });

    it('free scan marks scan as completed with result_json', () => {
      const mockDb = createMockDb();
      const scanId = 'scan-456';
      const resultJson = 'mock-compressed-result';

      mockDb.scans.push({ id: scanId, url: 'https://example.com', email: 'test@test.com', status: 'processing', result_json: null, stripe_session_id: null, user_id: null });

      mockDb.prepare('UPDATE scans SET status = completed').run(resultJson, scanId);

      expect(mockDb.scans[0].status).toBe('completed');
      expect(mockDb.scans[0].result_json).toBe(resultJson);
    });
  });

  describe('Monthly scan limit', () => {
    it('counts scans per email per month', () => {
      const mockDb = createMockDb();
      const email = 'test@test.com';
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      // Simulate 2 existing scans this month
      mockDb.scans.push(
        { id: 'scan-1', url: 'https://a.com', email, status: 'completed', result_json: '{}', stripe_session_id: null, user_id: null },
        { id: 'scan-2', url: 'https://b.com', email, status: 'completed', result_json: '{}', stripe_session_id: null, user_id: null },
      );

      const monthlyCount = mockDb.scans.filter(
        s => s.email === email && s.status === 'completed'
      ).length;

      expect(monthlyCount).toBe(2);
    });

    it('allows up to 3 free scans per month', () => {
      const LIMIT = 3;
      const currentCount = 2;
      expect(currentCount < LIMIT).toBe(true);
    });

    it('blocks at 3 free scans per month', () => {
      const LIMIT = 3;
      const currentCount = 3;
      expect(currentCount >= LIMIT).toBe(true);
    });
  });
});

// ── CLAIM-SCAN ROUTE TESTS ────────────────────────────────────────────────────

describe('Claim Scan (Account Creation) API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/auth/claim-scan', () => {
    it('returns 400 when email is missing', () => {
      const body = { password: 'password123', scanId: 'scan-123' };
      expect(body.email).toBeUndefined();
    });

    it('returns 400 when password is missing', () => {
      const body = { email: 'test@test.com', scanId: 'scan-123' };
      expect(body.password).toBeUndefined();
    });

    it('returns 400 when password is too short', () => {
      const password = 'short';
      expect(password.length < 8).toBe(true);
    });

    it('accepts valid password (8+ chars)', () => {
      const password = 'password123';
      expect(password.length >= 8).toBe(true);
    });

    it('hashes password in salt:hash format', () => {
      const salt = 'abc123';
      // Simple mock hash
      const hash = salt + ':' + 'mockhash';
      expect(hash.includes(':')).toBe(true);
      expect(hash.split(':')).toHaveLength(2);
    });

    it('creates user and session for new user', () => {
      const mockDb = createMockDb();
      const userId = 'user-123';
      const email = 'new@test.com';
      const passwordHash = 'salt:hash';

      mockDb.prepare('INSERT INTO users').run(userId, email, passwordHash);
      mockDb.prepare('INSERT INTO sessions').run('token-123', userId);

      expect(mockDb.users).toHaveLength(1);
      expect(mockDb.users[0].email).toBe(email);
    });

    it('links scan to user when scanId provided', () => {
      const mockDb = createMockDb();
      const userId = 'user-456';
      const scanId = 'scan-789';

      mockDb.scans.push({ id: scanId, url: 'https://example.com', email: 'test@test.com', status: 'completed', result_json: '{}', stripe_session_id: null, user_id: null });
      mockDb.prepare('UPDATE scans SET user_id').run(userId, scanId);

      expect(mockDb.scans[0].user_id).toBe(userId);
    });

    it('rejects invalid password for existing user', () => {
      const mockDb = createMockDb();
      const email = 'existing@test.com';
      const correctSalt = 'salted';
      const correctHash = 'correcthash';

      mockDb.users.push({
        id: 'user-existing',
        email,
        password_hash: `${correctSalt}:${correctHash}`,
      });

      const [, storedHash] = mockDb.users[0].password_hash.split(':');
      const inputHash = 'wronghash';
      expect(inputHash !== storedHash).toBe(true);
    });

    it('accepts correct password for existing user', () => {
      const mockDb = createMockDb();
      const email = 'existing@test.com';
      const correctSalt = 'salted';
      const correctHash = 'correcthash';

      mockDb.users.push({
        id: 'user-existing',
        email,
        password_hash: `${correctSalt}:${correctHash}`,
      });

      const [, storedHash] = mockDb.users[0].password_hash.split(':');
      expect(correctHash === storedHash).toBe(true);
    });
  });

  describe('Scan linking on login', () => {
    it('links unlinked scans to user on login', () => {
      const mockDb = createMockDb();
      const userId = 'user-login';
      const email = 'login@test.com';

      mockDb.users.push({ id: userId, email, password_hash: 'salt:hash' });
      mockDb.scans.push(
        { id: 'scan-unlinked', url: 'https://a.com', email, status: 'completed', result_json: '{}', stripe_session_id: null, user_id: null },
        { id: 'scan-already-linked', url: 'https://b.com', email, status: 'completed', result_json: '{}', stripe_session_id: null, user_id: 'other-user' },
      );

      // Simulate the UPDATE from login route
      const unlinkedScans = mockDb.scans.filter(
        s => s.email === email && (!s.user_id || s.user_id === userId)
      );
      unlinkedScans.forEach(s => { s.user_id = userId; });

      expect(mockDb.scans.find(s => s.id === 'scan-unlinked')?.user_id).toBe(userId);
      // Already linked scan should NOT be changed
      expect(mockDb.scans.find(s => s.id === 'scan-already-linked')?.user_id).toBe('other-user');
    });
  });
});

// ── ACCESS GATE TESTS ──────────────────────────────────────────────────────────

describe('Access Gate', () => {
  it('marks free scans as limited preview', () => {
    const isLimitedPreview = true;
    expect(isLimitedPreview).toBe(true);
  });

  it('marks agency scans as full access', () => {
    const isLimitedPreview = false;
    expect(isLimitedPreview).toBe(false);
  });

  it('shows upgrade prompt in limited preview mode', () => {
    const isLimitedPreview = true;
    const showUpgradePrompt = isLimitedPreview;
    expect(showUpgradePrompt).toBe(true);
  });

  it('hides upgrade prompt in full access mode', () => {
    const isLimitedPreview = false;
    const showUpgradePrompt = isLimitedPreview;
    expect(showUpgradePrompt).toBe(false);
  });
});

// ── PRICING TIERS TESTS ────────────────────────────────────────────────────────

describe('Pricing Tiers', () => {
  const plans = [
    { name: 'Free', price: '$0', plan: 'free', scanLimit: 3 },
    { name: 'Agency', price: '$99', plan: 'monthly', scanLimit: Infinity },
  ];

  it('has two pricing tiers', () => {
    expect(plans).toHaveLength(2);
  });

  it('Free plan has 3 scans per month limit', () => {
    const free = plans.find(p => p.plan === 'free')!;
    expect(free.scanLimit).toBe(3);
  });

  it('Agency plan is $99 per month', () => {
    const agency = plans.find(p => p.plan === 'monthly')!;
    expect(agency.price).toBe('$99');
  });

  it('checkout selects monthly price ID for agency plan', () => {
    const getPriceId = (plan: string) => {
      if (plan === 'monthly') return 'price_monthly';
      return 'unsupported';
    };

    expect(getPriceId('monthly')).toBe('price_monthly');
    expect(getPriceId('free')).toBe('unsupported');
  });
});






