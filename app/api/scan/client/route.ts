import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb, compressGzip } from '@/lib/env';
import { MOCK_SCAN_MODE, buildMockScanResult } from '@/lib/mock-scan';
import { verifySubscriberToken, touchSubscriberToken } from '@/lib/auth';
import { generateReportHtml } from '@/lib/report';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { clientId?: string; token?: string };
    const { clientId, token: explicitToken } = body;
    if (!clientId || !explicitToken) {
      return NextResponse.json({ error: 'Client ID and token are required' }, { status: 400 });
    }

    const env: any = (request as any).env ?? (globalThis as any).__env ?? undefined;
    const db = getDb(env);
    const subscriber = await verifySubscriberToken(db, explicitToken, 'agency');
    if (!subscriber) {
      return NextResponse.json({ error: 'Invalid token or not an agency subscriber' }, { status: 401 });
    }

    await touchSubscriberToken(db, explicitToken);

    const client = await db.prepare(`
      SELECT id, name, url, agency_subscriber_id
      FROM agency_clients
      WHERE id = ? AND agency_subscriber_id = ?
    `).get(clientId, subscriber.subscriber_id) as any;

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const scanId = uuidv4();
    await db.prepare(`
      INSERT INTO scans (id, url, email, status, subscriber_id)
      VALUES (?, ?, ?, 'processing', ?)
    `).run(scanId, client.url, subscriber.email, subscriber.subscriber_id);

    runClientScan(scanId, client.url, subscriber.email, env).catch(async (err) => {
      console.error('Client scan failed:', err);
      await db.prepare(`UPDATE scans SET status = 'failed' WHERE id = ?`).run(scanId);
    });

    return NextResponse.json({
      scanId,
      clientId,
      status: 'processing',
      message: 'Scan started for client. The report will appear in client history once ready.',
    });
  } catch (error: any) {
    console.error('Client scan error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function runClientScan(scanId: string, url: string, email: string | null, env: any) {
  const db = getDb(env);
  if (MOCK_SCAN_MODE) {
    const result = buildMockScanResult(url);
    const resultJson = await compressGzip(JSON.stringify(result));
    await db.prepare(`
      UPDATE scans
      SET status = 'completed', result_json = ?, completed_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
      WHERE id = ?
    `).run(resultJson, scanId);

    if (email && process.env.MAILJET_API_KEY && process.env.MAILJET_SECRET_KEY) {
      const { sendReportEmail } = await import('@/lib/mailjet');
      await sendReportEmail({
        email,
        subject: `GDPR Compliance Report for ${url}`,
        html: generateReportHtml(url, result as any),
      });
    }
    return;
  }

  const { crawlPage } = await import('@/lib/crawler');
  const { runRuleBasedChecks } = await import('@/lib/gdpr-checks');
  const { analyzeWithAI } = await import('@/lib/ai-analysis');

  const crawlResult = await crawlPage(url);
  const ruleChecks = runRuleBasedChecks(crawlResult);
  const aiResult = await analyzeWithAI(crawlResult, ruleChecks);

  const result = {
    crawl: {
      url,
      title: crawlResult.title,
      description: crawlResult.description,
      h1s: crawlResult.h1s,
      trackingScripts: crawlResult.trackingScripts,
      formsCount: crawlResult.formsCount,
      hasSSL: crawlResult.hasSSL,
      statusCode: crawlResult.statusCode,
    },
    ruleChecks,
    aiAnalysis: aiResult,
    scannedAt: new Date().toISOString(),
  };

  const resultJson = await compressGzip(JSON.stringify(result));
  await db.prepare(`
    UPDATE scans
    SET status = 'completed', result_json = ?, completed_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
    WHERE id = ?
  `).run(resultJson, scanId);

  if (email && process.env.RESEND_API_KEY) {
    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: 'ComplyScan <reports@complyscan.com>',
      to: email,
      subject: `GDPR Compliance Report for ${url}`,
      html: generateReportHtml(url, result as any),
    });
  }
}

