/**
 * Payment → Report Flow — End-to-End Playwright Test
 *
 * Tests the Stripe-less path:
 * 1. Create a pending scan directly in the DB (simulating what /api/stripe/checkout does)
 * 2. Navigate to /success?session_id=fake&scan_id=<scan_id>
 * 3. SuccessClient calls POST /api/scan/trigger (runs scan on this Lambda/instance)
 * 4. SuccessClient polls GET /api/report/[id] until 200
 * 5. Report renders inside the iframe
 *
 * Requires dev server running on port 3000.
 * Run with: npx playwright test tests/payment-report-flow.test.ts
 *
 * To start dev server manually: npm start (in /home/thomas/Dropbox/Projects/compliance-checker)
 */

import { test, expect, chromium, Browser, Page, BrowserContext } from '@playwright/test';
import path from 'path';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

// ── Configuration ────────────────────────────────────────────────────────────
const DEV_SERVER_URL = 'http://localhost:3000';
const DB_PATH = process.env.DATABASE_PATH || './data/complyscan.db';
const STARTUP_TIMEOUT_MS = 30_000; // wait for dev server to come up
const POLL_TIMEOUT_MS = 120_000;   // scan + report generation (generous)
const POLL_INTERVAL_MS = 3_000;

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Wait for the dev server to respond on port 3000 */
async function waitForDevServer(timeoutMs = STARTUP_TIMEOUT_MS): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${DEV_SERVER_URL}/`, { signal: AbortSignal.timeout(3_000) });
      if (res.ok || res.status === 200) return;
    } catch { /* not ready yet */ }
    await new Promise(r => setTimeout(r, 2_000));
  }
  throw new Error(`Dev server at ${DEV_SERVER_URL} did not start within ${timeoutMs}ms`);
}

/** Insert a pending scan directly into SQLite, bypassing Stripe */
function createPendingScan(scanId: string, url: string, email: string): void {
  const dbDir = path.dirname(path.resolve(DB_PATH));
  const fs = require('fs');
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  // Ensure schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS scans (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      result_json TEXT,
      email TEXT,
      stripe_session_id TEXT,
      subscriber_id TEXT,
      user_id TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
      completed_at TEXT
    );
  `);

  db.prepare(`
    INSERT OR REPLACE INTO scans (id, url, status, email, stripe_session_id)
    VALUES (?, ?, 'pending', ?, 'cs_test_fake_session')
  `).run(scanId, url, email);

  const row = db.prepare('SELECT * FROM scans WHERE id = ?').get(scanId) as Record<string, unknown>;
  db.close();
  if (!row) throw new Error(`Failed to insert scan ${scanId} into DB`);
  console.log(`[payment-report-flow] Created pending scan ${scanId} for ${url}`);
}

/** Navigate to success page and wait for the report to appear in the iframe */
async function waitForReportInIframe(page: Page, scanId: string): Promise<void> {
  console.log(`[payment-report-flow] Navigating to /success?session_id=fake&scan_id=${scanId}`);

  await page.goto(`${DEV_SERVER_URL}/success?session_id=fake&scan_id=${scanId}`, {
    waitUntil: 'domcontentloaded',
    timeout: 15_000,
  });

  // Wait for either:
  // - The report iframe becomes non-empty (reportStatus === 'ready')
  // - OR the "loading" spinner appears (reportStatus === 'pending'/'loading')
  // We poll the report API directly to know when to look for the iframe content

  const reportReady = await page.waitForFunction(
    async (opts: { scanId: string; pollInterval: number; timeout: number }) => {
      const deadline = Date.now() + opts.timeout;
      while (Date.now() < deadline) {
        try {
          const r = await fetch(`/api/report/${encodeURIComponent(opts.scanId)}`);
          if (r.status === 200) {
            const data = await r.json();
            if (data.reportHtml) return true;
          }
        } catch { /* ignore */ }
        await new Promise(r => setTimeout(r, opts.pollInterval));
      }
      return false;
    },
    { scanId, pollInterval: POLL_INTERVAL_MS, timeout: POLL_TIMEOUT_MS },
    { timeout: POLL_TIMEOUT_MS + 10_000 },
  );

  if (!reportReady) {
    throw new Error(`Report did not become ready within ${POLL_TIMEOUT_MS}ms for scan ${scanId}`);
  }

  console.log('[payment-report-flow] Report is ready, waiting for iframe content...');

  // Now wait for the SuccessClient to render the report iframe
  await page.waitForSelector('iframe[id="report-frame"]', { timeout: 10_000 });

  // Wait for iframe to have srcdoc content (the report HTML)
  await page.waitForFunction(
    () => {
      const iframe = document.getElementById('report-frame') as HTMLIFrameElement | null;
      if (!iframe) return false;
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      return doc && doc.body && doc.body.innerHTML.length > 100;
    },
    { timeout: 15_000 },
  );

  console.log('[payment-report-flow] Report iframe has content ✓');
}

// ── Test ──────────────────────────────────────────────────────────────────────

test.describe('Payment → Report Flow (no Stripe)', () => {
  test.setTimeout(POLL_TIMEOUT_MS + 60_000);

  test('full flow: create pending scan → /success page → scan triggers → report renders in iframe', async () => {
    // 1. Ensure dev server is up
    console.log('[payment-report-flow] Checking dev server at', DEV_SERVER_URL);
    try {
      await waitForDevServer(5_000);
      console.log('[payment-report-flow] Dev server already running ✓');
    } catch {
      console.log('[payment-report-flow] Dev server not running — test requires `npm start` on port 3000');
      test.skip();
      return;
    }

    // 2. Create a pending scan in DB with a known UUID
    const scanId = uuidv4();
    const testUrl = 'https://example.com';
    const testEmail = 'test-payment-flow@example.com';
    createPendingScan(scanId, testUrl, testEmail);

    // 3. Launch browser (headless: false as required)
    const browser: Browser = await chromium.launch({
      headless: false,   // as instructed
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const context: BrowserContext = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const page: Page = await context.newPage();

    // Capture console errors
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    try {
      // 4. Navigate to success page — this triggers the full SuccessClient flow:
      //    POST /api/scan/trigger → crawl → DB write → Stripe metadata (non-blocking)
      //    then polls GET /api/report/[id]
      await waitForReportInIframe(page, scanId);

      // 5. Verify the report rendered correctly
      const iframe = page.locator('iframe[id="report-frame"]');
      await expect(iframe).toBeVisible();

      // Verify report title appears in iframe
      const reportTitle = await page.evaluate(() => {
        const iframe = document.getElementById('report-frame') as HTMLIFrameElement;
        const doc = iframe?.contentDocument || iframe?.contentWindow?.document;
        return doc?.title || '';
      });
      expect(reportTitle).toContain('GDPR Compliance Report');

      // Verify the URL appears in the report
      const reportBody = await page.evaluate(() => {
        const iframe = document.getElementById('report-frame') as HTMLIFrameElement;
        const doc = iframe?.contentDocument || iframe?.contentWindow?.document;
        return doc?.body?.innerText || '';
      });
      expect(reportBody).toContain('example.com');

      // Verify checks are shown (rule checks appear in every report)
      expect(reportBody).toContain('Automated Checks');

      // Verify score appears
      expect(reportBody).toMatch(/\d+\s*out of 100/);

      // 6. No fatal console errors (allow network warnings)
      const fatalErrors = consoleErrors.filter(e =>
        !e.includes('net::ERR') && !e.includes('Failed to load resource')
      );
      expect(fatalErrors).toHaveLength(0);

      console.log('[payment-report-flow] ✅ Full payment→report flow verified');
    } finally {
      await browser.close();
    }
  });

  test('success page polling eventually returns report after scan completion', async () => {
    // Simple direct API test: create scan, trigger it, poll report
    const scanId = uuidv4();
    createPendingScan(scanId, 'https://httpbin.org/html', 'polling-test@example.com');

    try {
      await waitForDevServer(5_000);
    } catch {
      test.skip();
      return;
    }

    // Trigger scan via API
    const triggerRes = await fetch(`${DEV_SERVER_URL}/api/scan/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scanId }),
    });
    expect(triggerRes.ok).toBe(true);
    const triggerData = await triggerRes.json();
    expect(['completed', 'processing']).toContain(triggerData.status);

    // Poll report endpoint
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    let reportStatus = 202;
    while (Date.now() < deadline && reportStatus === 202) {
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
      const r = await fetch(`${DEV_SERVER_URL}/api/report/${encodeURIComponent(scanId)}`);
      reportStatus = r.status;
      if (reportStatus === 200) {
        const data = await r.json() as { reportHtml?: string };
        expect(data.reportHtml).toBeTruthy();
        expect(data.reportHtml).toContain('GDPR Compliance Report');
        console.log('[payment-report-flow] ✅ Report API polling verified');
        return;
      }
    }
    throw new Error(`Report never returned 200 within ${POLL_TIMEOUT_MS}ms`);
  });
});
