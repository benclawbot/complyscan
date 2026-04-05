import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/env';
import { v4 as uuidv4 } from 'uuid';

async function verifySession(request: NextRequest, db: ReturnType<typeof getDb>) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '') || request.cookies.get('session')?.value;
  if (!token) return null;

  const session = await db.prepare(`
    SELECT s.user_id, u.email FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.token=?
  `).get(token) as any;

  return session || null;
}

export async function GET(request: NextRequest, { params: _params }: { params: Promise<{ id: string }> }, env: any) {
  const db = getDb(env);
  const session = await verifySession(request, db);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const scans = await db.prepare(`
    SELECT id, url, status, created_at, completed_at
    FROM scans
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 50
  `).all(session.user_id);

  return NextResponse.json({ scans });
}

export async function POST(request: NextRequest, { params: _params }: { params: Promise<{ id: string }> }, env: any) {
  const db = getDb(env);
  const session = await verifySession(request, db);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { url } = await request.json() as { url?: string };
  if (!url) {
    return NextResponse.json({ error: 'URL required' }, { status: 400 });
  }

  const scanId = uuidv4();

  await db.prepare(`
    INSERT INTO scans (id, url, status, user_id)
    VALUES (?, ?, 'pending', ?)
  `).run(scanId, url, session.user_id);

  // Trigger async scan
  triggerScan(scanId, url, env).catch(console.error);

  return NextResponse.json({ scanId });
}

async function triggerScan(scanId: string, url: string, env: any) {
  const { crawlPage } = await import('@/lib/crawler');
  const { runRuleBasedChecks } = await import('@/lib/gdpr-checks');
  const { analyzeWithAI } = await import('@/lib/ai-analysis');

  const db = getDb(env);

  try {
    await db.prepare(`UPDATE scans SET status = 'processing' WHERE id = ?`).run(scanId);

    const crawlResult = await crawlPage(url);
    const ruleChecks = runRuleBasedChecks(crawlResult);
    const aiResult = await analyzeWithAI(crawlResult, ruleChecks);

    const result = {
      crawl: {
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

    await db.prepare(`
      UPDATE scans
      SET status = 'completed', result_json = ?, completed_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
      WHERE id = ?
    `).run(JSON.stringify(result), scanId);
  } catch (error: any) {
    console.error('Scan error:', error);
    await db.prepare(`UPDATE scans SET status = 'failed' WHERE id = ?`).run(scanId);
  }
}



