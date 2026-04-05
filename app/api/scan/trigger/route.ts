import { NextRequest, NextResponse } from 'next/server';
import { getDb, compressGzip, getRuntimeEnv, sendScanJob, parseResultJson } from '@/lib/env';
import { MOCK_SCAN_MODE, buildMockScanResult } from '@/lib/mock-scan';

export async function POST(request: NextRequest) {
  let scanId: string | undefined;
  let url: string | undefined;
  let email: string | undefined;
  let sessionId: string | undefined;

  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const body = await request.json() as { scanId?: string; url?: string; email?: string; id?: string; sessionId?: string };
    scanId = body.scanId || body.id;
    url = body.url;
    email = body.email;
    sessionId = body.sessionId;
  } else {
    const formData = await request.formData();
    scanId = (formData.get('scanId') as string) || (formData.get('id') as string);
    url = (formData.get('url') as string) || undefined;
    email = (formData.get('email') as string) || undefined;
    sessionId = (formData.get('sessionId') as string) || undefined;
  }

  if (!url) {
    return NextResponse.json({ error: 'url is required' }, { status: 400 });
  }

  const env: any = getRuntimeEnv((request as any).env ?? (globalThis as any).__env ?? undefined);
  const db = getDb(env);

  if (!scanId) {
    const { v4: uuidv4 } = await import('uuid');
    scanId = uuidv4();
  }

  const existingScan = await db.prepare('SELECT * FROM scans WHERE id = ?').get(scanId) as any;
  if (existingScan?.status === 'completed' && existingScan.result_json) {
    const result = await parseResultJson(existingScan.result_json);
    return NextResponse.json({ status: 'completed', result: result || {}, scanId });
  }
  if (existingScan?.status === 'processing' || existingScan?.status === 'pending') {
    return NextResponse.json({ status: 'queued', scanId });
  }

  await db.prepare(`
    INSERT OR REPLACE INTO scans (id, url, status, email, stripe_session_id, created_at)
    VALUES (?, ?, 'pending', ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
  `).run(scanId, url, email || null, sessionId || null);

  if (env?.SCAN_QUEUE) {
    await sendScanJob({ scanId, url, email, trigger: 'stripe' }, env);
    return NextResponse.json({ status: 'queued', scanId });
  }

  try {
    if (MOCK_SCAN_MODE) {
      await db.prepare(`UPDATE scans SET status = 'processing' WHERE id = ?`).run(scanId);
      const result = buildMockScanResult(url);
      const resultJson = await compressGzip(JSON.stringify(result));
      await db.prepare(`
        UPDATE scans
        SET status = 'completed', result_json = ?, completed_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), stripe_session_id = COALESCE(?, stripe_session_id)
        WHERE id = ?
      `).run(resultJson, sessionId || null, scanId);
      return NextResponse.json({ status: 'completed', result, scanId });
    }

    await db.prepare(`UPDATE scans SET status = 'failed' WHERE id = ?`).run(scanId);
    return NextResponse.json({ error: 'Scan queue is not configured' }, { status: 500 });
  } catch (err: any) {
    console.error(`Scan ${scanId} failed:`, err.message);
    await db.prepare(`UPDATE scans SET status = 'failed' WHERE id = ?`).run(scanId);
    return NextResponse.json({ error: err.message || 'Scan failed' }, { status: 500 });
  }
}
