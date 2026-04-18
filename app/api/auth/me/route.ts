import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/env';
import { getSessionToken, getUserSession, touchUserSession, getActiveSubscriberForUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const token = getSessionToken(request as any);
  if (!token) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const env: any = (request as any).env ?? (globalThis as any).__env ?? undefined;
  const db = getDb(env);

  const session = await getUserSession(db, token);
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  await touchUserSession(db, token);

  const subscriber = await getActiveSubscriberForUser(db, session.user_id);
  if (subscriber) {
    return NextResponse.json({
      authenticated: true,
      email: session.email,
      type: 'subscriber',
      subscriberId: subscriber.id,
      plan: subscriber.plan,
      status: subscriber.status,
      currentPeriodEnd: subscriber.current_period_end,
      cancelAtPeriodEnd: Boolean(subscriber.cancel_at_period_end),
      userId: session.user_id,
      credits: Number(session.credits ?? 0),
    });
  }

  return NextResponse.json({
    authenticated: true,
    email: session.email,
    type: 'user',
    userId: session.user_id,
    credits: Number(session.credits ?? 0),
  });
}
