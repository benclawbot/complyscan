import { test, expect } from '@playwright/test';

const TEST_URL = 'https://example.com';

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

test.describe('ComplyScan local E2E', () => {
  test('free scan flow renders preview results', async ({ page }) => {
    const email = uniqueEmail('free');

    await page.goto('/');
    await page.locator('input[type="url"]').fill(TEST_URL);
    await page.locator('input[type="email"]').fill(email);
    await page.locator('form').getByRole('button', { name: /scan free/i }).click();

    await page.waitForURL(/\/scan-results\//, { timeout: 120_000 });
    await expect(page.getByText(/gdpr compliance report/i)).toBeVisible({ timeout: 120_000 });
    await expect(page.getByText(/free preview/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /upgrade to agency/i })).toBeVisible();
  });

  test('agency upgrade CTA from scan results redirects to Stripe checkout', async ({ page }) => {
    const email = uniqueEmail('agency-upgrade');

    await page.goto('/');
    await page.locator('input[type="url"]').fill(TEST_URL);
    await page.locator('input[type="email"]').fill(email);
    await page.locator('form').getByRole('button', { name: /scan free/i }).click();

    await page.waitForURL(/\/scan-results\//, { timeout: 120_000 });

    const upgradePanel = page.locator('#upgrade-prompt');
    await expect(upgradePanel.getByRole('button', { name: /start agency plan/i })).toBeVisible({ timeout: 120_000 });
    await upgradePanel.getByRole('button', { name: /start agency plan/i }).click();

    await page.waitForURL(/checkout\.stripe\.com/, { timeout: 30_000 });
  });

  test('monthly agency subscription completes checkout and reaches dashboard', async ({ page }) => {
    await page.goto('/');
    await page.locator('#pricing').scrollIntoViewIfNeeded();

    const startBtn = page.getByRole('button', { name: /start agency/i });
    await startBtn.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await startBtn.click({ timeout: 15_000, force: true });

    await page.waitForURL(/checkout\.stripe\.com/, { timeout: 30_000 });

    const cardNumber = page.locator('input[placeholder="1234 1234 1234 1234"]').first();
    const cardHolder = page.locator('input[placeholder="Full name on card"]').first();

    if (await cardNumber.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await cardNumber.fill('4242424242424242');
      await page.locator('input[placeholder="MM / YY"]').fill('1228');
      await page.locator('input[placeholder="CVC"]').fill('123');
      await cardHolder.fill('Agency Test User');

      const countrySelect = page.locator('[data-testid="billing-address"] select, select[placeholder*="Country"]').first();
      if (await countrySelect.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await countrySelect.selectOption('US');
      }
    }

    await page.waitForTimeout(1000);
    const payButton = page.getByRole('button', { name: /pay|continue/i }).first();
    if (await payButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await payButton.click();
    }

    await page.waitForURL(/\/success\/?/, { timeout: 90_000 });
    await expect(page.getByText(/subscription active/i)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole('link', { name: /go to dashboard/i })).toBeVisible({ timeout: 60_000 });
    await page.getByRole('link', { name: /go to dashboard/i }).click();

    await page.waitForURL(/\/dashboard(\?token=.*)?$/, { timeout: 60_000 });
  });
});
