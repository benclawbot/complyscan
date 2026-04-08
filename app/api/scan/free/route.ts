import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb, compressGzip, getRuntimeEnv, sendScanJob } from '@/lib/env';
import { crawlPage } from '@/lib/crawler';
import { analyzeWithAI } from '@/lib/ai-analysis';
import { runRuleBasedChecks } from '@/lib/gdpr-checks';
import { normalizeScanResultV2 } from '@/lib/scan-normalize';

const FREE_SCAN_LIMIT = 3;

async function getMonthlyScanCount(db: ReturnType<typeof getDb>, email: string): Promise<number> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const row = await db.prepare(
    'SELECT COUNT(*) as count FROM scans WHERE email = ? AND created_at >= ?'
  ).get(email, startOfMonth.toISOString()) as { count?: number } | undefined;
  return row?.count ?? 0;
}

export async function POST(request: NextRequest) {
  const { url, email } = await request.json() as { url?: string; email?: string };

  if (!url) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }
  if (!email) {
    return NextResponse.json({ error: 'Email is required for free scans' }, { status: 400 });
  }

  const env: any = getRuntimeEnv((request as any).env ?? (globalThis as any).__env ?? undefined);
  const db = getDb(env);

  const count = await getMonthlyScanCount(db, email);
  if (count >= FREE_SCAN_LIMIT) {
    return NextResponse.json(
      {
        error: `Free scan limit reached (${FREE_SCAN_LIMIT}/month). Upgrade to Pro for unlimited scans.`,
        code: 'LIMIT_REACHED',
      },
      { status: 429 }
    );
  }

  const scanId = uuidv4();
  await db.prepare(
    `INSERT INTO scans (id, url, status, email, stripe_session_id, created_at)
     VALUES (?, ?, 'pending', ?, NULL, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))`
  ).run(scanId, url, email);

    const mockScan =
      env?.MOCK_SCAN === '1' ||
      process.env?.MOCK_SCAN === '1' ||
      env?.MOCK_STRIPE === '1' ||
      process.env?.MOCK_STRIPE === '1';

    if (mockScan) {
      const raw = {
        crawl: {
          url,
          title: 'Mock Scan Result',
          description: 'Mock compliance result for deterministic local E2E testing.',
          h1s: ['Mock Website'],
          trackingScripts: ['google-analytics'],
          formsCount: 1,
          formInputsLabeled: true,
          totalFormInputs: 2,
          hasSSL: true,
          statusCode: 200,
          hasPrivacyPolicy: false,
          hasCookiePolicyPage: false,
          hasCookieBanner: false,
          cookieBannerText: '',
          privacyPolicyUrl: null,
          thirdPartyEmbeds: [],
        },
        ruleChecks: [
          {
            id: 'cookie_banner_present',
            name: 'Cookie banner present',
            passed: false,
            detail: 'Cookie banner not detected.',
            recommendation: 'Add a GDPR-compliant cookie consent banner.',
          },
        ],
        aiAnalysis: {
          gdprScore: 68,
          riskLevel: 'MEDIUM',
          summary: 'Mock scan completed successfully for local test execution.',
          issues: [
            {
              severity: 'high',
              title: 'Cookie banner missing',
              description: 'No consent banner was detected.',
              fix: 'Implement a compliant opt-in cookie banner.',
            },
            {
              severity: 'medium',
              title: 'Privacy policy missing',
              description: 'Privacy policy page could not be found.',
              fix: 'Publish a privacy policy and link it site-wide.',
            },
          ],
          positives: [],
        },
        scannedAt: new Date().toISOString(),
      };

      const normalized = normalizeScanResultV2({
        url,
        crawl: raw.crawl as any,
        ruleChecks: raw.ruleChecks as any,
        aiAnalysis: raw.aiAnalysis as any,
        scannedAt: raw.scannedAt,
      });

      const resultJson = await compressGzip(JSON.stringify(normalized));
      await db.prepare(
        `UPDATE scans
         SET status = 'completed', result_json = ?, completed_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
         WHERE id = ?`
      ).run(resultJson, scanId);

      return NextResponse.json({ scanId, status: 'completed', result: normalized });
    }

    if (env?.SCAN_QUEUE) {
      await sendScanJob({ scanId, url, email, trigger: 'free' }, env);
      import('@/lib/mailjet').then(({ subscribeToNurture }) => {
        subscribeToNurture({ email, scanUrl: url }).catch(() => {});
      });
      return NextResponse.json({ scanId, status: 'queued' });
    }

    // No queue configured — run synchronously
    await db.prepare(`UPDATE scans SET status = 'processing' WHERE id = ?`).run(scanId);

    let crawlResult;
    try {
      crawlResult = await crawlPage(url);
    } catch (err: any) {
      console.error(`Crawl failed for ${url}:`, err.message);
      await db.prepare(`UPDATE scans SET status = 'failed' WHERE id = ?`).run(scanId);
      return NextResponse.json({ error: `Crawl failed: ${err.message}` }, { status: 500 });
    }

    const ruleChecks = runRuleBasedChecks(crawlResult);
    const aiResult = await analyzeWithAI(crawlResult, ruleChecks);

    const scannedAt = new Date().toISOString();
    const normalized = normalizeScanResultV2({
      url,
      crawl: crawlResult,
      ruleChecks,
      aiAnalysis: aiResult,
      scannedAt,
    });

    const resultJson = await compressGzip(JSON.stringify(normalized));
    await db.prepare(
      `UPDATE scans
       SET status = 'completed', result_json = ?, completed_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
       WHERE id = ?`
    ).run(resultJson, scanId);

    return NextResponse.json({ scanId, status: 'completed', result: normalized });
}
