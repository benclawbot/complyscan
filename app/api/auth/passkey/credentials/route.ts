import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/env';
import { requireUserSession } from '@/lib/auth';
import { hasValidCsrf, csrfErrorResponse } from '@/lib/csrf';

export async function GET(request: NextRequest) {
  const env: any = (request as any).env ?? (globalThis as any).__env ?? undefined;
  const db = getDb(env);
  const auth = await requireUserSession(request as any, db);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rows = await db.prepare(`
    SELECT id, credential_id, created_at, updated_at
    FROM passkey_credentials
    WHERE user_id = ?
    ORDER BY created_at DESC
  `).all(auth.session.user_id) as any[];

  return NextResponse.json({
    credentials: rows.map((r) => ({
      id: r.id,
      label: `${String(r.credential_id).slice(0, 10)}…`,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })),
  });
}

export async function DELETE(request: NextRequest) {
  if (!hasValidCsrf(request as any)) {
    return csrfErrorResponse();
  }

  const env: any = (request as any).env ?? (globalThis as any).__env ?? undefined;
  const db = getDb(env);
  const auth = await requireUserSession(request as any, db);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json() as { id?: string };
  const id = String(body.id || '').trim();
  if (!id) return NextResponse.json({ error: 'Passkey id is required' }, { status: 400 });

  await db.prepare('DELETE FROM passkey_credentials WHERE id = ? AND user_id = ?').run(id, auth.session.user_id);
  return NextResponse.json({ ok: true });
}
