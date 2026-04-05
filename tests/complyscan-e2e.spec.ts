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
    await expect(page.getByRole('button', { name: /get pdf report/i })).toBeVisible();
  });

  test('premium PDF flow reaches report page and PDF endpoint works', async ({ page, request }) => {
    const email = uniqueEmail('pdf');

    await page.goto('/');
    await page.locator('input[type="url"]').fill(TEST_URL);
    await page.locator('input[type="email"]').fill(email);
    await page.locator('form').getByRole('button', { name: /scan free/i }).click();

    await page.waitForURL(/\/scan-results\//, { timeout: 120_000 });
    await expect(page.getByRole('button', { name: /get pdf report/i })).toBeVisible({ timeout: 120_000 });
    await page.getByRole('button', { name: /get pdf report/i }).click();

    await page.waitForURL(/\/report\//, { timeout: 120_000 });
    await expect(page.getByText(/your gdpr report is ready/i)).toBeVisible();

    const reportUrl = new URL(page.url());
    const scanId = reportUrl.pathname.split('/').pop()!;
    const sessionId = reportUrl.searchParams.get('session_id');
    expect(sessionId).toBeTruthy();

    const pdfResponse = await request.get(`/api/report/${scanId}/pdf?session_id=${encodeURIComponent(sessionId!)}`);
    expect(pdfResponse.ok()).toBe(true);
    expect(pdfResponse.headers()['content-type']).toContain('application/pdf');
  });

  test('monthly agency subscription reaches dashboard and client management UI', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /start agency/i }).click();

    await page.waitForURL(/\/success\?/, { timeout: 60_000 });
    await expect(page.getByText(/subscription active/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /go to dashboard/i })).toBeVisible({ timeout: 60_000 });
    await page.getByRole('link', { name: /go to dashboard/i }).click();

    await page.waitForURL(/\/dashboard(\?token=.*)?$/, { timeout: 60_000 });


    await page.getByPlaceholder('Client Name').fill('Example Client');
    await page.getByPlaceholder('https://client-website.com').fill(TEST_URL);
    await page.getByRole('button', { name: /add client/i }).click();

    await expect(page.getByText(/added successfully/i)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('cell', { name: 'Example Client' })).toBeVisible();
    await page.getByRole('button', { name: /rescan/i }).first().click();
    await expect(page.getByText(/scan started/i)).toBeVisible({ timeout: 30_000 });
  });
});
