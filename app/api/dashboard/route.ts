import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/env';
import { getBearerToken, verifySubscriberToken, touchSubscriberToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const token = getBearerToken(request) || request.cookies.get('session_token')?.value || request.cookies.get('session')?.value;
  if (!token) {
    return NextResponse.json({ error: 'Token required' }, { status: 401 });
  }

  const env: any = (request as any).env ?? (globalThis as any).__env ?? undefined;
  const db = getDb(env);

  const tokenRecord = await verifySubscriberToken(db, token);
  if (!tokenRecord) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  await touchSubscriberToken(db, token);

  const recentScans = await db.prepare(`
    SELECT id, url, status, result_json, created_at, completed_at
    FROM scans
    WHERE subscriber_id = ?
    ORDER BY created_at DESC
    LIMIT 20
  `).all(tokenRecord.subscriber_id) as any[];

  return NextResponse.json({
    subscriber: {
      email: tokenRecord.email,
      plan: tokenRecord.plan,
      status: tokenRecord.status,
      currentPeriodEnd: tokenRecord.current_period_end,
      cancelAtPeriodEnd: Boolean(tokenRecord.cancel_at_period_end),
    },
    recentScans,
  });
}
