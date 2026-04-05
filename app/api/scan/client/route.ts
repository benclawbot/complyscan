import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb, sendScanJob } from '@/lib/env';
import { MOCK_SCAN_MODE, buildMockScanResult } from '@/lib/mock-scan';
import { verifySubscriberToken, touchSubscriberToken } from '@/lib/auth';

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
      VALUES (?, ?, ?, 'pending', ?)
    `).run(scanId, client.url, subscriber.email, subscriber.subscriber_id);

    if (env?.SCAN_QUEUE) {
      await sendScanJob({ scanId, url: client.url, email: subscriber.email, trigger: 'subscriber' }, env);
    } else if (MOCK_SCAN_MODE) {
      await db.prepare(`UPDATE scans SET status = 'processing' WHERE id = ?`).run(scanId);
      const result = buildMockScanResult(client.url);
      const { compressGzip } = await import('@/lib/env');
      const resultJson = await compressGzip(JSON.stringify(result));
      await db.prepare(`
        UPDATE scans
        SET status = 'completed', result_json = ?, completed_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
        WHERE id = ?
      `).run(resultJson, scanId);
    } else {
      await db.prepare(`UPDATE scans SET status = 'failed' WHERE id = ?`).run(scanId);
      return NextResponse.json({ error: 'Scan queue is not configured' }, { status: 500 });
    }

    return NextResponse.json({
      scanId,
      clientId,
      status: env?.SCAN_QUEUE ? 'queued' : 'completed',
      message: 'Scan started for client. The report will appear in client history once ready.',
    });
  } catch (error: any) {
    console.error('Client scan error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

