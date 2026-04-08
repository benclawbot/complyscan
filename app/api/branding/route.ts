import { NextRequest, NextResponse } from 'next/server';
import { getDb, getRuntimeEnv } from '@/lib/env';
import { getBearerToken, getSubscriberTokenRecord, getUserSession, touchSubscriberToken, touchUserSession } from '@/lib/auth';
import { getBranding, upsertBranding } from '@/lib/branding';

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function GET(request: NextRequest) {
  const token = getBearerToken(request) || request.cookies.get('session_token')?.value || request.cookies.get('session')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const env: any = getRuntimeEnv((request as any).env ?? (globalThis as any).__env ?? undefined);
  const db = getDb(env);

  const sub = await getSubscriberTokenRecord(db, token);
  if (sub) {
    await touchSubscriberToken(db, token);
    const branding = await getBranding(db, { type: 'subscriber', id: sub.subscriber_id });
    return NextResponse.json({ branding });
  }

  const session = await getUserSession(db, token);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await touchUserSession(db, token);

  const branding = await getBranding(db, { type: 'user', id: session.user_id });
  return NextResponse.json({ branding });
}

export async function POST(request: NextRequest) {
  const token = getBearerToken(request) || request.cookies.get('session_token')?.value || request.cookies.get('session')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null) as any;
  if (!body || typeof body !== 'object') return badRequest('Invalid JSON');

  const agencyName = typeof body.agencyName === 'string' ? body.agencyName.trim().slice(0, 80) : null;
  const logoUrl = typeof body.logoUrl === 'string' ? body.logoUrl.trim().slice(0, 500) : null;
  const logoDataUrl = typeof body.logoDataUrl === 'string' ? body.logoDataUrl.trim().slice(0, 2_000_000) : null;

  if (logoDataUrl && !logoDataUrl.startsWith('data:image/')) {
    return badRequest('logoDataUrl must be a data:image/* URL');
  }

  const env: any = getRuntimeEnv((request as any).env ?? (globalThis as any).__env ?? undefined);
  const db = getDb(env);

  const sub = await getSubscriberTokenRecord(db, token);
  if (sub) {
    await touchSubscriberToken(db, token);
    await upsertBranding(db, { type: 'subscriber', id: sub.subscriber_id }, { agencyName, logoUrl, logoDataUrl });
    return NextResponse.json({ ok: true });
  }

  const session = await getUserSession(db, token);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await touchUserSession(db, token);

  await upsertBranding(db, { type: 'user', id: session.user_id }, { agencyName, logoUrl, logoDataUrl });
  return NextResponse.json({ ok: true });
}

