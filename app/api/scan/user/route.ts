import { NextRequest, NextResponse } from 'next/server';
import { getDb, getRuntimeEnv, sendScanJob } from '@/lib/env';
import { v4 as uuidv4 } from 'uuid';
import { requireUserSession } from '@/lib/auth';
import { hasValidCsrf, csrfErrorResponse } from '@/lib/csrf';

export async function GET(request: NextRequest, { params: _params }: { params: Promise<{ id: string }> }, env: any) {
  env = getRuntimeEnv(env);
  const db = getDb(env);
  const auth = await requireUserSession(request as any, db);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const scans = await db.prepare(`
    SELECT id, url, status, created_at, completed_at
    FROM scans
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 50
  `).all(auth.session.user_id);

  return NextResponse.json({ scans });
}

export async function POST(request: NextRequest, { params: _params }: { params: Promise<{ id: string }> }, env: any) {
  if (!hasValidCsrf(request as any)) {
    return csrfErrorResponse();
  }

  env = getRuntimeEnv(env);
  const db = getDb(env);
  const auth = await requireUserSession(request as any, db);
  if (!auth) {
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
  `).run(scanId, url, auth.session.user_id);

  if (!env?.SCAN_QUEUE) {
    await db.prepare(`UPDATE scans SET status = 'failed' WHERE id = ?`).run(scanId);
    return NextResponse.json({ error: 'Scan queue is not configured' }, { status: 500 });
  }

  await sendScanJob({ scanId, url, email: auth.session.email, trigger: 'free' }, env);

  return NextResponse.json({ scanId, status: 'queued' });
}
