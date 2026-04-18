import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb, getRuntimeEnv, sendScanJob } from '@/lib/env';
import { requireAgencySession } from '@/lib/auth';
import { hasValidCsrf, csrfErrorResponse } from '@/lib/csrf';

export async function POST(request: NextRequest) {
  if (!hasValidCsrf(request as any)) {
    return csrfErrorResponse();
  }

  try {
    const env: any = getRuntimeEnv((request as any).env ?? (globalThis as any).__env ?? undefined);
    const db = getDb(env);
    const auth = await requireAgencySession(request as any, db);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as { clientId?: string };
    const clientId = String(body?.clientId || '').trim();
    if (!clientId) {
      return NextResponse.json({ error: 'Client ID is required' }, { status: 400 });
    }

    const client = await db.prepare(`
      SELECT id, name, url, agency_subscriber_id
      FROM agency_clients
      WHERE id = ? AND agency_subscriber_id = ?
    `).get(clientId, auth.subscriber.id) as any;

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const scanId = uuidv4();
    await db.prepare(`
      INSERT INTO scans (id, url, email, status, subscriber_id)
      VALUES (?, ?, ?, 'pending', ?)
    `).run(scanId, client.url, auth.session.email, auth.subscriber.id);

    if (!env?.SCAN_QUEUE) {
      await db.prepare(`UPDATE scans SET status = 'failed' WHERE id = ?`).run(scanId);
      return NextResponse.json({ error: 'Scan queue is not configured' }, { status: 500 });
    }

    await sendScanJob({ scanId, url: client.url, email: auth.session.email, trigger: 'subscriber' }, env);

    return NextResponse.json({ ok: true, scanId, client: { id: client.id, name: client.name, url: client.url } });
  } catch (err: any) {
    console.error('Client scan error:', err.message || err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
