/**
 * Playwright test helpers — cleanup utilities for E2E tests
 */
const BASE_URL = process.env.BASE_URL || 'https://complyscan2.pages.dev';

export async function cleanUpTestScans(email: string): Promise<void> {
  try {
    await fetch(`${BASE_URL}/api/test/cleanup?email=${encodeURIComponent(email)}`, {
      method: 'DELETE',
    }).catch(() => { /* cleanup is best-effort */ });
  } catch {}
}

export async function cleanUpTestSubscribers(email: string): Promise<void> {
  try {
    await fetch(`${BASE_URL}/api/test/cleanup-subscriber?email=${encodeURIComponent(email)}`, {
      method: 'DELETE',
    }).catch(() => {});
  } catch {}
}

export async function waitForUrl(url: string, options: {
  timeout?: number;
  interval?: number;
  expectedStatus?: number;
} = {}): Promise<void> {
  const { timeout = 120_000, interval = 3000, expectedStatus = 200 } = options;
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (res.status === expectedStatus) return;
    } catch {}
    await new Promise(r => setTimeout(r, interval));
  }
  throw new Error(`URL ${url} did not return ${expectedStatus} within ${timeout}ms`);
}

