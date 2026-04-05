import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb, sendScanJob, compressGzip } from '@/lib/env';
import { MOCK_SCAN_MODE, buildMockScanResult } from '@/lib/mock-scan';
import { getBearerToken, verifySubscriberToken, touchSubscriberToken } from '@/lib/auth';
import { generateReportHtml } from '@/lib/report';

async function getSubscriberFromRequest(request: NextRequest, explicitToken?: string) {
  const env: any = (request as any).env ?? (globalThis as any).__env ?? undefined;
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

    const env: any = (request as any).env ?? (globalThis as any).__env ?? undefined;
    if (env?.SCAN_QUEUE) {
      await sendScanJob({ scanId, url, email: subscriber.email, trigger: 'subscriber' }, env);
      return NextResponse.json({ scanId, status: 'queued', message: 'Scan queued.' });
    }

    if (MOCK_SCAN_MODE) {
      await db.prepare(`UPDATE scans SET status = 'processing' WHERE id = ?`).run(scanId);
      const result = buildMockScanResult(url);
      const resultJson = await compressGzip(JSON.stringify(result));
      await db.prepare(`
        UPDATE scans
        SET status = 'completed', result_json = ?, completed_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
        WHERE id = ?
      `).run(resultJson, scanId);
      return NextResponse.json({ scanId, status: 'completed', result, message: 'Scan complete.' });
    }

    await db.prepare(`UPDATE scans SET status = 'failed' WHERE id = ?`).run(scanId);
    return NextResponse.json({ error: 'Scan queue is not configured' }, { status: 500 });
  } catch (error: any) {
    console.error('Subscriber scan error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
