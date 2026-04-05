import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb, parseResultJson } from '@/lib/env';
import { getBearerToken, verifySubscriberToken } from '@/lib/auth';

async function requireAgencySubscriber(request: NextRequest) {
  const token = getBearerToken(request);
  const env: any = (request as any).env ?? (globalThis as any).__env ?? undefined;
  const db = getDb(env);
  if (!token) return { db, subscriber: null, token: null };
  const subscriber = await verifySubscriberToken(db, token, 'agency');
  return { db, subscriber, token };
}

export async function GET(request: NextRequest) {
  const { db, subscriber } = await requireAgencySubscriber(request);
  if (!subscriber) {
    return NextResponse.json({ error: 'Invalid token or not an agency subscriber' }, { status: 401 });
  }

  const clients = await db.prepare(`
    SELECT id, name, url, created_at
    FROM agency_clients
    WHERE agency_subscriber_id = ?
    ORDER BY created_at DESC
  `).all(subscriber.subscriber_id) as any[];

  const clientsWithScans = await Promise.all(clients.map(async (client) => {
    const lastScan = await db.prepare(`
      SELECT id, status, created_at, completed_at, result_json
      FROM scans
      WHERE subscriber_id = ? AND url = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).get(subscriber.subscriber_id, client.url) as any;

    let complianceStatus = 'unknown';
    let gdprScore: number | null = null;

    if (lastScan?.status === 'completed' && lastScan?.result_json) {
      const parsed = await parseResultJson(lastScan.result_json);
      gdprScore = parsed?.aiAnalysis?.gdprScore ?? null;
      if (gdprScore !== null) {
        complianceStatus = gdprScore >= 75 ? 'compliant' : 'non-compliant';
      }
    } else if (lastScan?.status === 'processing' || lastScan?.status === 'pending') {
      complianceStatus = 'scanning';
    }

    return {
      ...client,
      lastScanId: lastScan?.id || null,
      lastScanDate: lastScan?.completed_at || lastScan?.created_at || null,
      lastScanStatus: lastScan?.status || null,
      complianceStatus,
      gdprScore,
    };
  }));

  return NextResponse.json({ clients: clientsWithScans });
}

export async function POST(request: NextRequest) {
  const { db, subscriber } = await requireAgencySubscriber(request);
  if (!subscriber) {
    return NextResponse.json({ error: 'Invalid token or not an agency subscriber' }, { status: 401 });
  }

  try {
    const body = await request.json() as { name?: string; url?: string };
    const { name, url } = body;
    if (!name || !url) {
      return NextResponse.json({ error: 'Name and URL are required' }, { status: 400 });
    }

    try {
      const parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('Invalid protocol');
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    const existing = await db.prepare(`
      SELECT id FROM agency_clients
      WHERE agency_subscriber_id = ? AND url = ?
    `).get(subscriber.subscriber_id, url);

    if (existing) {
      return NextResponse.json({ error: 'Client with this URL already exists' }, { status: 409 });
    }

    const clientId = uuidv4();
    await db.prepare(`
      INSERT INTO agency_clients (id, agency_subscriber_id, name, url)
      VALUES (?, ?, ?, ?)
    `).run(clientId, subscriber.subscriber_id, name, url);

    const client = await db.prepare('SELECT * FROM agency_clients WHERE id = ?').get(clientId);
    return NextResponse.json({ client }, { status: 201 });
  } catch (error: any) {
    console.error('Add client error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
