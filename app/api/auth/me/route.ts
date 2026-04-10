import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/env';
import { getBearerToken, verifySubscriberToken, getUserSession, touchSubscriberToken, touchUserSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const token = getBearerToken(request) || request.cookies.get('session_token')?.value || request.cookies.get('session')?.value;
  if (!token) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const env: any = (request as any).env ?? (globalThis as any).__env ?? undefined;
  const db = getDb(env);

  const subToken = await verifySubscriberToken(db, token);
  if (subToken) {
    await touchSubscriberToken(db, token);

    return NextResponse.json({
      authenticated: true,
      email: subToken.email,
      type: 'subscriber',
      subscriberId: subToken.subscriber_id,
      plan: subToken.plan,
      status: subToken.status,
      currentPeriodEnd: subToken.current_period_end,
      cancelAtPeriodEnd: Boolean(subToken.cancel_at_period_end),
    });
  }

  const session = await getUserSession(db, token);
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  await touchUserSession(db, token);

  return NextResponse.json({
    authenticated: true,
    email: session.email,
    type: 'user',
    userId: session.user_id,
    credits: Number(session.credits ?? 0),
  });
}


