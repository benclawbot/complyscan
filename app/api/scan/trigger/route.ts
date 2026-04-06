import { NextRequest, NextResponse } from 'next/server';
import { getDb, getRuntimeEnv, sendScanJob, parseResultJson } from '@/lib/env';
import { buildMockScanResult } from '@/lib/mock-scan';

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

  if (env?.MOCK_STRIPE === '1' || env?.E2E_TEST_MODE === '1') {
    const result = buildMockScanResult(url, true);
    await db.prepare(`
      UPDATE scans
      SET status = 'completed', result_json = ?, completed_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
      WHERE id = ?
    `).run(JSON.stringify(result), scanId);
    return NextResponse.json({ status: 'completed', scanId, result });
  }

  if (!env?.SCAN_QUEUE) {
    await db.prepare(`UPDATE scans SET status = 'failed' WHERE id = ?`).run(scanId);
    return NextResponse.json({ error: 'Scan queue is not configured' }, { status: 500 });
  }

  await sendScanJob({ scanId, url, email, trigger: 'stripe' }, env);
  return NextResponse.json({ status: 'queued', scanId });
}






