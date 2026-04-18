import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/env';
import { getBranding, upsertBranding } from '@/lib/branding';
import { requireUserSession, getActiveSubscriberForUser } from '@/lib/auth';
import { hasValidCsrf, csrfErrorResponse } from '@/lib/csrf';

async function resolveOwner(request: NextRequest) {
  const env: any = (request as any).env ?? (globalThis as any).__env ?? undefined;
  const db = getDb(env);
  const auth = await requireUserSession(request as any, db);
  if (!auth) return { db, owner: null };

  const sub = await getActiveSubscriberForUser(db, auth.session.user_id, 'agency');
  if (sub) {
    return { db, owner: { type: 'subscriber' as const, id: sub.id } };
  }

  return { db, owner: { type: 'user' as const, id: auth.session.user_id } };
}

export async function GET(request: NextRequest) {
  const { db, owner } = await resolveOwner(request);
  if (!owner) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const branding = await getBranding(db, owner);
  return NextResponse.json({ branding: branding || null });
}

export async function POST(request: NextRequest) {
  if (!hasValidCsrf(request as any)) {
    return csrfErrorResponse();
  }

  const { db, owner } = await resolveOwner(request);
  if (!owner) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json() as { agencyName?: string; logoUrl?: string; logoDataUrl?: string };
  const agencyName = (body.agencyName || '').trim();
  const logoUrl = (body.logoUrl || '').trim();
  const logoDataUrl = (body.logoDataUrl || '').trim();

  if (logoDataUrl && !/^data:image\//.test(logoDataUrl)) {
    return NextResponse.json({ error: 'Invalid logo data format' }, { status: 400 });
  }

  await upsertBranding(db, owner, {
    agencyName,
    logoUrl,
    logoDataUrl,
  });

  return NextResponse.json({ ok: true });
}
