import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/env';
import { requireAgencySession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const env: any = (request as any).env ?? (globalThis as any).__env ?? undefined;
  const db = getDb(env);
  const auth = await requireAgencySession(request as any, db);

  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const recentScans = await db.prepare(`
    SELECT id, url, status, result_json, created_at, completed_at
    FROM scans
    WHERE subscriber_id = ?
    ORDER BY created_at DESC
    LIMIT 20
  `).all(auth.subscriber.id) as any[];

  return NextResponse.json({
    subscriber: {
      email: auth.session.email,
      plan: auth.subscriber.plan,
      status: auth.subscriber.status,
      currentPeriodEnd: auth.subscriber.current_period_end,
      cancelAtPeriodEnd: Boolean(auth.subscriber.cancel_at_period_end),
    },
    recentScans,
  });
}
