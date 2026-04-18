import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb, getRuntimeEnv, sendScanJob, compressGzip } from '@/lib/env';
import { crawlPage } from '@/lib/crawler';
import { analyzeWithAI } from '@/lib/ai-analysis';
import { runRuleBasedChecks } from '@/lib/gdpr-checks';
import { requireAgencySession } from '@/lib/auth';
import { normalizeScanResultV2 } from '@/lib/scan-normalize';
import { hasValidCsrf, csrfErrorResponse } from '@/lib/csrf';

async function requireAgency(request: NextRequest) {
  const env: any = getRuntimeEnv((request as any).env ?? (globalThis as any).__env ?? undefined);
  const db = getDb(env);
  const auth = await requireAgencySession(request as any, db);
  return { env, db, auth };
}

export async function GET(request: NextRequest) {
  const { db, auth } = await requireAgency(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const scans = await db.prepare(`
    SELECT id, url, status, created_at, completed_at
    FROM scans
    WHERE subscriber_id = ?
    ORDER BY created_at DESC
    LIMIT 50
  `).all(auth.subscriber.id);

  return NextResponse.json({ scans });
}

export async function POST(request: NextRequest) {
  if (!hasValidCsrf(request as any)) {
    return csrfErrorResponse();
  }

  try {
    const body = await request.json() as { url?: string };
    const { url } = body;

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    try {
      const parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Invalid protocol');
      }
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    const { env, db, auth } = await requireAgency(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const scanId = uuidv4();
    await db.prepare(`
      INSERT INTO scans (id, url, email, status, subscriber_id, created_at)
      VALUES (?, ?, ?, 'pending', ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    `).run(scanId, url, auth.session.email, auth.subscriber.id);

    if (env?.SCAN_QUEUE) {
      await sendScanJob({ scanId, url, email: auth.session.email, trigger: 'subscriber' }, env);
      return NextResponse.json({ scanId, status: 'queued', message: 'Scan queued.' });
    }

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
    await db.prepare(`UPDATE scans SET status = 'completed', result_json = ?, completed_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?`).run(resultJson, scanId);
    return NextResponse.json({ scanId, status: 'completed', result: normalized, message: 'Scan complete.' });
  } catch (error: any) {
    console.error('Subscriber scan error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
