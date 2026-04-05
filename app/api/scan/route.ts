import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb, compressGzip, decompressGzip } from '@/lib/env';
import { crawlPage } from '@/lib/crawler';
import { runRuleBasedChecks } from '@/lib/gdpr-checks';
import { analyzeWithAI } from '@/lib/ai-analysis';

export async function POST(request: NextRequest, { params: _params }: { params: Promise<{ id: string }> }, env: any) {
  let scanId: string | undefined;
  let db: ReturnType<typeof getDb> | undefined;

  try {
    const body = await request.json() as { url?: string; email?: string };
    const { url, email } = body;

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Invalid protocol');
      }
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    scanId = uuidv4();
    db = getDb(env);

    await db.prepare(`
      INSERT INTO scans (id, url, email, status)
      VALUES (?, ?, ?, 'processing')
    `).run(scanId, url, email || null);

    let scanError: Error | null = null;
    try {
      // Run synchronously with timeout so errors propagate properly
      const timeoutMs = 55_000;
      await Promise.race([
        processScanAsync(scanId, url, env),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Scan timed out after 55s')), timeoutMs)),
      ]);
    } catch (err: any) {
      console.error('Scan processing error:', err.message);
      scanError = err;
    }

    if (scanError) {
      await db.prepare(`UPDATE scans SET status = 'failed' WHERE id = ?`).run(scanId);
      return NextResponse.json({ error: scanError.message || 'Scan failed' }, { status: 500 });
    }

    const completed = await db.prepare('SELECT status, result_json FROM scans WHERE id = ?').get(scanId) as any;

    let parsedResult = undefined;
    if (completed?.result_json) {
      try {
        const firstBytes = atob(completed.result_json.slice(0, Math.ceil(2 * 4 / 3)));
        const isGzip = firstBytes.charCodeAt(0) === 0x1f && firstBytes.charCodeAt(1) === 0x8b;
        if (isGzip) {
          parsedResult = JSON.parse(await decompressGzip(completed.result_json));
        } else {
          parsedResult = JSON.parse(completed.result_json);
        }
      } catch {}
    }

    return NextResponse.json({
      scanId,
      status: completed?.status || 'processing',
      result: parsedResult,
    });
  } catch (error: any) {
    // Only reaches here for truly unexpected errors (JSON parse, DB init, etc.)
    if (db && scanId) {
      await db!.prepare(`UPDATE scans SET status = 'failed' WHERE id = ?`).run(scanId!);
    }
    console.error('Unexpected scan error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

async function processScanAsync(scanId: string, url: string, env: any) {
  const db = getDb(env);

  const crawlResult = await crawlPage(url);
  const ruleChecks = runRuleBasedChecks(crawlResult);
  const aiResult = await analyzeWithAI(crawlResult, ruleChecks);

  const result = {
    crawl: {
      url,
      title: crawlResult.title,
      description: crawlResult.description,
      h1s: crawlResult.h1s,
      trackingScripts: crawlResult.trackingScripts || [],
      formsCount: crawlResult.formsCount ?? 0,
      formInputsLabeled: crawlResult.formInputsLabeled ?? 0,
      totalFormInputs: crawlResult.totalFormInputs ?? 0,
      hasSSL: crawlResult.hasSSL ?? false,
      statusCode: crawlResult.statusCode ?? 0,
      hasPrivacyPolicy: crawlResult.hasPrivacyPolicy ?? false,
      hasCookiePolicyPage: crawlResult.hasCookiePolicyPage ?? false,
      hasCookieBanner: crawlResult.hasCookieBanner ?? false,
      thirdPartyEmbeds: crawlResult.thirdPartyEmbeds || [],
    },
    ruleChecks,
    aiAnalysis: aiResult,
    scannedAt: new Date().toISOString(),
  };

  // Validate JSON before storing — Lambda filesystem can corrupt large writes
  // Compress with gzip + base64: adds CRC32 checksum for corruption detection,
  // reduces size ~75% (16KB → ~1KB), and handles encoding issues
  let resultJson: string;
  try {
    const rawJson = JSON.stringify(result);
    // Verify round-trip
    JSON.parse(rawJson);
    resultJson = await compressGzip(rawJson);
  } catch (err: any) {
    console.error('JSON serialization failed:', err.message);
    await db.prepare(`UPDATE scans SET status = 'failed' WHERE id = ?`).run(scanId);
    throw new Error(`Scan result serialization failed: ${err.message}`);
  }

  await db.prepare(`
    UPDATE scans
    SET status = 'completed', result_json = ?, completed_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
    WHERE id = ?
  `).run(resultJson, scanId);
}


