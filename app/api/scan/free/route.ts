import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb, compressGzip, sendScanJob } from '@/lib/env';
import { MOCK_SCAN_MODE, buildMockScanResult } from '@/lib/mock-scan';

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

  const env: any = (request as any).env ?? (globalThis as any).__env ?? undefined;
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

  if (env?.SCAN_QUEUE) {
    await sendScanJob({ scanId, url, email, trigger: 'free' }, env);
    import('@/lib/mailjet').then(({ subscribeToNurture }) => {
      subscribeToNurture({ email, scanUrl: url }).catch(() => {});
    });
    return NextResponse.json({ scanId, status: 'queued' });
  }

  await db.prepare(`UPDATE scans SET status = 'processing' WHERE id = ?`).run(scanId);

  try {
    if (MOCK_SCAN_MODE) {
      const result = buildMockScanResult(url);
      const resultJson = await compressGzip(JSON.stringify(result));
      await db.prepare(
        `UPDATE scans
         SET status = 'completed', result_json = ?, completed_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
         WHERE id = ?`
      ).run(resultJson, scanId);
      return NextResponse.json({ scanId, status: 'completed', result });
    }

    const { crawlPage } = await import('@/lib/crawler');
    const { runRuleBasedChecks } = await import('@/lib/gdpr-checks');
    const { analyzeWithAI } = await import('@/lib/ai-analysis');

    const crawlResult = await crawlPage(url);
    const ruleChecks = runRuleBasedChecks(crawlResult);
    const aiResult = await analyzeWithAI(crawlResult, ruleChecks);

    const result = {
      crawl: {
        title: crawlResult.title,
        description: crawlResult.description,
        url: crawlResult.url,
        h1s: crawlResult.h1s,
        trackingScripts: crawlResult.trackingScripts,
        formsCount: crawlResult.formsCount,
        hasSSL: crawlResult.hasSSL,
        statusCode: crawlResult.statusCode,
        hasPrivacyPolicy: crawlResult.hasPrivacyPolicy,
        hasCookiePolicyPage: crawlResult.hasCookiePolicyPage,
        hasCookieBanner: crawlResult.hasCookieBanner,
        cookieBannerText: crawlResult.cookieBannerText,
        privacyPolicyUrl: crawlResult.privacyPolicyUrl,
        formInputsLabeled: crawlResult.formInputsLabeled,
        totalFormInputs: crawlResult.totalFormInputs,
        thirdPartyEmbeds: crawlResult.thirdPartyEmbeds,
      },
      ruleChecks,
      aiAnalysis: aiResult,
      scannedAt: new Date().toISOString(),
    };

    const resultJson = await compressGzip(JSON.stringify(result));
    await db.prepare(
      `UPDATE scans
       SET status = 'completed', result_json = ?, completed_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
       WHERE id = ?`
    ).run(resultJson, scanId);

    import('@/lib/mailjet').then(({ subscribeToNurture }) => {
      subscribeToNurture({ email, scanUrl: url }).catch(() => {});
    });

    return NextResponse.json({ scanId, status: 'completed', result });
  } catch (err: any) {
    console.error(`Free scan ${scanId} failed:`, err.message);
    await db.prepare(`UPDATE scans SET status = 'failed' WHERE id = ?`).run(scanId);
    return NextResponse.json({ error: err.message || 'Scan failed' }, { status: 500 });
  }
}
