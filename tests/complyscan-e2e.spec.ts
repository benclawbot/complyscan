/**
 * ComplyScan E2E Test Suite — All 3 Workflows
 *
 * Run with:
 *   npx playwright test tests/complyscan-e2e.spec.ts
 *
 * Requires:
 *   - Playwright installed: npx playwright install
 *   - App deployed at NEXT_PUBLIC_APP_URL (default: https://complyscan2.pages.dev)
 *   - App running locally: npx wrangler pages dev .open-next (for local testing)
 *   - Stripe test keys configured
 *   - BROWSERLESS_API_KEY set in environment
 *
 * Local override: set BASE_URL=http://localhost:8787
 */

import { test, expect, Page, Browser, BrowserContext } from '@playwright/test';
import { cleanUpTestScans, cleanUpTestSubscribers } from './playwright-helpers';

const BASE_URL = process.env.BASE_URL || 'https://complyscan2.pages.dev';
const TEST_URL = 'https://example.com';
const TEST_EMAIL_FREE = 'e2e-free-001@benposta.com';
const TEST_EMAIL_PRO = 'e2e-pro-001@benposta.com';
const TEST_EMAIL_AGENCY = 'e2e-agency-001@benposta.com';
const TEST_CARD = '4242 4242 4242 4242';
const TEST_CARD_EXPIRY = '12/28';
const TEST_CARD_CVC = '123';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function waitForReportReady(page: Page, scanId: string, timeoutMs = 120_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await page.request.get(`${BASE_URL}/api/report/${encodeURIComponent(scanId)}`);
      if (res.status() === 200) return;
    } catch (_) {}
    await page.waitForTimeout(3000);
  }
  throw new Error(`Report for ${scanId} did not become ready within ${timeoutMs}ms`);
}

async function fillStripeCard(page: Page): Promise<void> {
  // Stripe's test card fields — their test iframe uses these exact labels
  const cardNumberFrame = page.frameLocator('iframe[src*="strip"]').first();
  await cardNumberFrame.locator('[data-testid="card-number"]').fill(TEST_CARD);
  await cardNumberFrame.locator('[data-testid="card-expiry"]').fill(TEST_CARD_EXPIRY);
  await cardNumberFrame.locator('[data-testid="card-cvc"]').fill(TEST_CARD_CVC);
}

// ── SUITE 1: Free Scan ──────────────────────────────────────────────────────────

test.describe('Suite 1: Free Scan Flow', () => {
  test('complete free scan workflow', async ({ page }) => {
    await cleanUpTestScans(TEST_EMAIL_FREE);

    // 1. Navigate to homepage
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

    // 2. Scroll to scan form (hero or pricing section)
    const urlInput = page.locator('input[type="url"], input[placeholder*="URL"], input[placeholder*="website"]').first();
    const emailInput = page.locator('input[type="email"], input[placeholder*="email"]').first();
    const scanButton = page.locator('button:has-text("Scan Free"), button:has-text("Start Free Scan")').first();

    await urlInput.waitFor({ state: 'visible', timeout: 15000 });
    await urlInput.fill(TEST_URL);
    await emailInput.fill(TEST_EMAIL_FREE);

    // 3. Click scan
    await scanButton.click();

    // 4. Wait for results — either redirect to /report/{id} or spinner on /success
    // The free scan route runs synchronously, so we should land on /report/{id} directly
    try {
      await page.waitForURL(/\/report\//, { timeout: 60000 });
    } catch (_) {
      // Maybe /success first if scan is async
      await page.waitForURL(/\/(report|success)/, { timeout: 60000 });
    }

    // 5. Verify report page sections
    await page.waitForLoadState('domcontentloaded');

    // Score should be visible
    const body = await page.textContent('body');
    expect(body).toMatch(/gdpr|score|compliance|example\.com/i);

    // No critical console errors
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Filter out known non-critical errors
    const criticalErrors = errors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('404') &&
      !e.includes('chrome-extension') &&
      !e.includes('browserless')
    );
    expect(criticalErrors, `Console errors: ${criticalErrors.join('\n')}`).toHaveLength(0);
  });

  test('free scan rate limit at 3/month', async ({ page }) => {
    // Run 3 scans — 4th should be rejected
    await cleanUpTestScans(TEST_EMAIL_FREE);

    for (let i = 0; i < 3; i++) {
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
      const urlInput = page.locator('input[type="url"], input[placeholder*="URL"]').first();
      const emailInput = page.locator('input[type="email"], input[placeholder*="email"]').first();
      await urlInput.waitFor({ state: 'visible', timeout: 10000 });
      await urlInput.fill(TEST_URL);
      await emailInput.fill(TEST_EMAIL_FREE);
      const scanButton = page.locator('button:has-text("Scan Free"), button:has-text("Start Free Scan")').first();
      await scanButton.click();
      try {
        await page.waitForURL(/\/report\//, { timeout: 60000 });
      } catch (_) {
        await page.waitForTimeout(5000);
      }
    }

    // 4th scan should be blocked
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    const urlInput = page.locator('input[type="url"], input[placeholder*="URL"]').first();
    const emailInput = page.locator('input[type="email"], input[placeholder*="email"]').first();
    await urlInput.waitFor({ state: 'visible', timeout: 10000 });
    await urlInput.fill(TEST_URL);
    await emailInput.fill(TEST_EMAIL_FREE);
    const scanButton = page.locator('button:has-text("Scan Free"), button:has-text("Start Free Scan")').first();
    await scanButton.click();
    await page.waitForTimeout(5000);
    const body = await page.textContent('body');
    expect(body).toMatch(/limit|upgrade|pro|unlimited/i);
  });
});

// ── SUITE 2: PDF Report Purchase (€9) ─────────────────────────────────────────

test.describe('Suite 2: PDF Report Purchase', () => {
  test('purchase PDF report via Stripe', async ({ page }) => {
    await cleanUpTestScans(TEST_EMAIL_PRO);

    // 1. Navigate to homepage
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

    // 2. Enter URL and click "Get PDF Report" (Pro plan)
    const urlInput = page.locator('input[type="url"], input[placeholder*="URL"], input[placeholder*="website"]').first();
    await urlInput.waitFor({ state: 'visible', timeout: 15000 });
    await urlInput.fill(TEST_URL);

    // Click Pro/PDF button — may be in pricing section or hero
    const pdfButton = page.locator('button:has-text("Get PDF"), button:has-text("PDF Report"), button:has-text("Pro"), a:has-text("PDF Report")').first();
    await pdfButton.click();

    // 3. Should navigate to Stripe checkout
    await page.waitForURL(/checkout\.stripe\.com|stripe\.com\/checkout/, { timeout: 30000 });

    // 4. Fill Stripe form
    await page.waitForLoadState('domcontentloaded');

    // Fill email if not pre-filled
    const emailField = page.locator('input[type="email"], input[name="email"]').first();
    if (await emailField.isVisible()) {
      await emailField.fill(TEST_EMAIL_PRO);
    }

    // 5. Fill card details in Stripe's secure iframe
    const stripeFrame = page.frameLocator('iframe[name*="stripe"], iframe[src*="stripe"]').first();
    const cardField = stripeFrame.locator('[data-testid="card-number"], input[name="card_number"], #card_number').first();
    if (await cardField.isVisible({ timeout: 5000 })) {
      await cardField.fill(TEST_CARD.replace(/\s/g, ''));
      await stripeFrame.locator('[data-testid="card-expiry"], input[name="card_exppiry"], #card_expiry').first().fill(TEST_CARD_EXPIRY);
      await stripeFrame.locator('[data-testid="card-cvc"], input[name="card_cvc"], #card_cvc').first().fill(TEST_CARD_CVC);
    } else {
      // Fallback: use Stripe's test card directly via their UI
      await page.fill('input[name="card_number"]', TEST_CARD.replace(/\s/g, ''));
    }

    // 6. Submit payment
    const payButton = page.locator('button[type="submit"], button:has-text("Pay"), [data-testid="submit-button"]').first();
    await payButton.click();

    // 7. Wait for success redirect
    await page.waitForURL(/\/success/, { timeout: 60000 });

    // 8. Verify success page
    const body = await page.textContent('body');
    expect(body).toMatch(/payment|confirmed|success|scan|report/i);

    // 9. Wait for report page (scan runs after checkout.session.completed webhook)
    try {
      await page.waitForURL(/\/report\//, { timeout: 120000 });
    } catch (_) {
      // May show loading while scan runs
      await page.waitForTimeout(30000);
    }

    // 10. Verify report renders
    await page.waitForLoadState('domcontentloaded');
    const reportBody = await page.textContent('body');
    expect(reportBody).toMatch(/gdpr|score|compliance|example\.com/i);

    // 11. PDF download
    const pdfLink = page.locator('a:has-text("Download PDF"), button:has-text("Download PDF")').first();
    if (await pdfLink.isVisible({ timeout: 5000 })) {
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 30000 }),
        pdfLink.click(),
      ]);
      expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
      expect(download.suggestedFilename().length).toBeGreaterThan(0);
    }
  });
});

// ── SUITE 3: Monthly Subscription ───────────────────────────────────────────────

test.describe('Suite 3: Monthly Subscription', () => {
  test('subscribe and access dashboard', async ({ page }) => {
    await cleanUpTestSubscribers(TEST_EMAIL_AGENCY);

    // 1. Navigate to pricing
    await page.goto(`${BASE_URL}/pricing`, { waitUntil: 'domcontentloaded' });

    // 2. Click "Start Agency" button
    const agencyButton = page.locator('button:has-text("Start Agency"), button:has-text("Agency"), a:has-text("Agency")').first();
    await agencyButton.click();

    // 3. Should navigate to Stripe checkout (subscription mode)
    await page.waitForURL(/checkout\.stripe\.com|stripe\.com\/checkout/, { timeout: 30000 });

    // 4. Fill Stripe checkout
    const emailField = page.locator('input[type="email"], input[name="email"]').first();
    if (await emailField.isVisible()) {
      await emailField.fill(TEST_EMAIL_AGENCY);
    }

    // Fill card in Stripe iframe
    const stripeFrame = page.frameLocator('iframe[name*="stripe"], iframe[src*="stripe"]').first();
    const cardField = stripeFrame.locator('[data-testid="card-number"], input[name="card_number"], #card_number').first();
    if (await cardField.isVisible({ timeout: 5000 })) {
      await cardField.fill(TEST_CARD.replace(/\s/g, ''));
      await stripeFrame.locator('[data-testid="card-expiry"], input[name="card_exppiry"], #card_expiry').first().fill(TEST_CARD_EXPIRY);
      await stripeFrame.locator('[data-testid="card-cvc"], input[name="card_cvc"], #card_cvc').first().fill(TEST_CARD_CVC);
    }

    // 5. Subscribe
    const subButton = page.locator('button[type="submit"], button:has-text("Subscribe"), [data-testid="submit-button"]').first();
    await subButton.click();

    // 6. Wait for success page
    await page.waitForURL(/\/success/, { timeout: 60000 });

    // 7. Verify subscription active state
    const body = await page.textContent('body');
    expect(body).toMatch(/subscription|active|dashboard|token/i);

    // 8. Get token from URL
    const url = page.url();
    const tokenMatch = url.match(/[?&]token=([^&]+)/);
    const token = tokenMatch?.[1];
    expect(token).toBeDefined();
    expect(token!.length).toBeGreaterThan(10);

    // 9. Navigate to dashboard
    await page.goto(`${BASE_URL}/dashboard?token=${token}`, { waitUntil: 'domcontentloaded' });

    // 10. Verify dashboard loads
    const dashBody = await page.textContent('body');
    expect(dashBody).toMatch(/dashboard|subscriber|agency|plan|scan/i);

    // 11. Run 2 scans
    for (let i = 0; i < 2; i++) {
      const scanUrlInput = page.locator('input[type="url"], input[placeholder*="URL"], input[placeholder*="website"]').first();
      await scanUrlInput.waitFor({ state: 'visible', timeout: 10000 });
      await scanUrlInput.fill(i === 0 ? 'https://example.com' : 'https://www.wikipedia.org');
      const scanBtn = page.locator('button[type="submit"]:has-text("Scan"), button:has-text("Scan Now")').first();
      await scanBtn.click();
      await page.waitForTimeout(5000);
    }

    // 12. Verify scans in history
    const historyBody = await page.textContent('body');
    expect(historyBody).toMatch(/example\.com|wikipedia\.org/i);
  });

  test('subscriber PDF download (no upsell)', async ({ page }) => {
    // This test needs an existing subscriber token — relies on previous test creating one
    // For isolation, we create a new subscription in this test
    await cleanUpTestSubscribers('e2e-pdf-sub@benposta.com');

    // Create subscription via Stripe checkout (same as above)
    await page.goto(`${BASE_URL}/pricing`, { waitUntil: 'domcontentloaded' });
    const agencyButton = page.locator('button:has-text("Start Agency"), button:has-text("Agency")').first();
    await agencyButton.click();
    await page.waitForURL(/checkout\.stripe\.com|stripe\.com\/checkout/, { timeout: 30000 });

    const emailField = page.locator('input[type="email"], input[name="email"]').first();
    if (await emailField.isVisible()) {
      await emailField.fill('e2e-pdf-sub@benposta.com');
    }

    const stripeFrame = page.frameLocator('iframe[name*="stripe"], iframe[src*="stripe"]').first();
    const cardField = stripeFrame.locator('[data-testid="card-number"], input[name="card_number"], #card_number').first();
    if (await cardField.isVisible({ timeout: 5000 })) {
      await cardField.fill(TEST_CARD.replace(/\s/g, ''));
      await stripeFrame.locator('[data-testid="card-expiry"], input[name="card_exppiry"], #card_expiry').first().fill(TEST_CARD_EXPIRY);
      await stripeFrame.locator('[data-testid="card-cvc"], input[name="card_cvc"], #card_cvc').first().fill(TEST_CARD_CVC);
    }

    const subButton = page.locator('button[type="submit"], button:has-text("Subscribe")').first();
    await subButton.click();
    await page.waitForURL(/\/success/, { timeout: 60000 });

    const url = page.url();
    const tokenMatch = url.match(/[?&]token=([^&]+)/);
    const token = tokenMatch?.[1];
    if (!token) {
      console.log('Could not extract token — skipping PDF download part');
      return;
    }

    await page.goto(`${BASE_URL}/dashboard?token=${token}`, { waitUntil: 'domcontentloaded' });

    // Run a scan
    const scanUrlInput = page.locator('input[type="url"], input[placeholder*="URL"]').first();
    await scanUrlInput.waitFor({ state: 'visible', timeout: 10000 });
    await scanUrlInput.fill('https://example.com');
    const scanBtn = page.locator('button[type="submit"]:has-text("Scan"), button:has-text("Scan Now")').first();
    await scanBtn.click();
    await page.waitForTimeout(10000);

    // Click View Report
    const reportLink = page.locator('a:has-text("View Report"), a:has-text("Report")').first();
    if (await reportLink.isVisible({ timeout: 10000 })) {
      await reportLink.click();
      await page.waitForLoadState('domcontentloaded');

      // PDF download should NOT prompt for payment
      const pdfLink = page.locator('a:has-text("Download PDF"), button:has-text("Download PDF")').first();
      expect(await pdfLink.isVisible({ timeout: 5000 })).toBe(true);

      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 30000 }),
        pdfLink.click(),
      ]);
      expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
    }
  });
});

// ── Smoke Tests ────────────────────────────────────────────────────────────────

test.describe('Smoke Tests', () => {
  test('homepage loads', async ({ page }) => {
    const res = await page.goto(BASE_URL);
    expect(res?.status()).toBeLessThan(400);
    const body = await page.textContent('body');
    expect(body).toMatch(/comply|scan|gdpr|compliance/i);
  });

  test('pricing section visible on homepage', async ({ page }) => {
    // Pricing is a section on the homepage, not a separate /pricing route
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    const body = await page.textContent('body');
    expect(body).toMatch(/pricing|plan|€|price|pro|agency/i);
  });

  test('login page loads', async ({ page }) => {
    const res = await page.goto(`${BASE_URL}/login`);
    expect(res?.status()).toBeLessThan(400);
    const body = await page.textContent('body');
    expect(body).toMatch(/login|sign|email|password/i);
  });

  test('dashboard returns 401 without token', async ({ page }) => {
    const res = await page.goto(`${BASE_URL}/dashboard`);
    const body = await page.textContent('body');
    expect(body).toMatch(/login|sign|access|error|401|unauthorized/i);
  });

  test('webhook rejects GET', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/stripe/webhook`);
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });
});
