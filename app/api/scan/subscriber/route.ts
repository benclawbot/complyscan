import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb, getRuntimeEnv, sendScanJob, compressGzip } from '@/lib/env';
import { crawlPage } from '@/lib/crawler';
import { analyzeWithAI } from '@/lib/ai-analysis';
import { runRuleBasedChecks } from '@/lib/gdpr-checks';
import { getBearerToken, verifySubscriberToken, touchSubscriberToken } from '@/lib/auth';

async function getSubscriberFromRequest(request: NextRequest, explicitToken?: string) {
  const env: any = getRuntimeEnv((request as any).env ?? (globalThis as any).__env ?? undefined);
  const db = getDb(env);
  const token = explicitToken || getBearerToken(request);
  if (!token) return { db, token: null, subscriber: null };
  const subscriber = await verifySubscriberToken(db, token);
  return { db, token, subscriber };
}

export async function GET(request: NextRequest) {
  const { db, token, subscriber } = await getSubscriberFromRequest(request);
  if (!token || !subscriber) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
  }

  await touchSubscriberToken(db, token);

  const scans = await db.prepare(`
    SELECT id, url, status, created_at, completed_at
    FROM scans
    WHERE email = ?
    ORDER BY created_at DESC
    LIMIT 50
  `).all(subscriber.email);

  return NextResponse.json({ scans });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { url?: string; token?: string };
    const { url, token: explicitToken } = body;

    if (!url || !explicitToken) {
      return NextResponse.json({ error: 'URL and token are required' }, { status: 400 });
    }

    try {
      const parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Invalid protocol');
      }
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    const { db, token, subscriber } = await getSubscriberFromRequest(request, explicitToken);
    if (!token || !subscriber) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    await touchSubscriberToken(db, token);

    const scanId = uuidv4();
    await db.prepare(`
      INSERT INTO scans (id, url, email, status, subscriber_id, created_at)
      VALUES (?, ?, ?, 'pending', ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    `).run(scanId, url, subscriber.email, subscriber.subscriber_id);

    const env: any = getRuntimeEnv((request as any).env ?? (globalThis as any).__env ?? undefined);
    if (env?.SCAN_QUEUE) {
      await sendScanJob({ scanId, url, email: subscriber.email, trigger: 'subscriber' }, env);
      return NextResponse.json({ scanId, status: 'queued', message: 'Scan queued.' });
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

    const result = {
      crawl: {
        url: crawlResult.url,
        title: crawlResult.title,
        description: crawlResult.description,
        h1s: crawlResult.h1s,
        trackingScripts: crawlResult.trackingScripts,
        formsCount: crawlResult.formsCount,
        formInputsLabeled: crawlResult.formInputsLabeled,
        totalFormInputs: crawlResult.totalFormInputs,
        hasSSL: crawlResult.hasSSL,
        statusCode: crawlResult.statusCode,
        hasPrivacyPolicy: crawlResult.hasPrivacyPolicy,
        hasCookiePolicyPage: crawlResult.hasCookiePolicyPage,
        hasCookieBanner: crawlResult.hasCookieBanner,
        cookieBannerText: crawlResult.cookieBannerText,
        privacyPolicyUrl: crawlResult.privacyPolicyUrl,
        thirdPartyEmbeds: crawlResult.thirdPartyEmbeds,
      },
      ruleChecks,
      aiAnalysis: aiResult,
      scannedAt: new Date().toISOString(),
    };

    const resultJson = await compressGzip(JSON.stringify(result));
    await db.prepare(`UPDATE scans SET status = 'completed', result_json = ?, completed_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?`).run(resultJson, scanId);
    return NextResponse.json({ scanId, status: 'completed', result, message: 'Scan complete.' });
  } catch (error: any) {
    console.error('Subscriber scan error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


