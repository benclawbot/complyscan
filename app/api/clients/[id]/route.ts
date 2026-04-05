import { NextRequest, NextResponse } from 'next/server';
import { getDb, parseResultJson } from '@/lib/env';
import { getBearerToken, verifySubscriberToken } from '@/lib/auth';

async function requireAgencySubscriber(request: NextRequest) {
  const token = getBearerToken(request);
  const env: any = (request as any).env ?? (globalThis as any).__env ?? undefined;
  const db = getDb(env);
  if (!token) return { db, subscriber: null };
  const subscriber = await verifySubscriberToken(db, token, 'agency');
  return { db, subscriber };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { db, subscriber } = await requireAgencySubscriber(request);
  const { id: clientId } = await params;

  if (!subscriber) {
    return NextResponse.json({ error: 'Invalid token or not an agency subscriber' }, { status: 401 });
  }

  const client = await db.prepare(`
    SELECT id, name, url, created_at
    FROM agency_clients
    WHERE id = ? AND agency_subscriber_id = ?
  `).get(clientId, subscriber.subscriber_id) as any;

  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }

  const scans = await db.prepare(`
    SELECT id, url, status, created_at, completed_at, result_json
    FROM scans
    WHERE subscriber_id = ? AND url = ?
    ORDER BY created_at DESC
    LIMIT 50
  `).all(subscriber.subscriber_id, client.url) as any[];

  const scansWithStatus = await Promise.all(scans.map(async (scan) => {
    const parsed = scan.result_json ? await parseResultJson(scan.result_json) : null;
    const gdprScore = parsed?.aiAnalysis?.gdprScore ?? null;
    return {
      id: scan.id,
      url: scan.url,
      status: scan.status,
      created_at: scan.created_at,
      completed_at: scan.completed_at,
      complianceStatus: gdprScore === null ? 'unknown' : gdprScore >= 75 ? 'compliant' : 'non-compliant',
      gdprScore,
    };
  }));

  return NextResponse.json({
    client: {
      ...client,
      complianceStatus: scansWithStatus[0]?.complianceStatus || 'unknown',
      lastScanDate: scansWithStatus[0]?.completed_at || scansWithStatus[0]?.created_at || null,
    },
    scans: scansWithStatus,
  });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { db, subscriber } = await requireAgencySubscriber(request);
  const { id: clientId } = await params;

  if (!subscriber) {
    return NextResponse.json({ error: 'Invalid token or not an agency subscriber' }, { status: 401 });
  }

  const client = await db.prepare(`
    SELECT id FROM agency_clients
    WHERE id = ? AND agency_subscriber_id = ?
  `).get(clientId, subscriber.subscriber_id);

  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }

  await db.prepare('DELETE FROM agency_clients WHERE id = ?').run(clientId);
  return NextResponse.json({ success: true });
}
