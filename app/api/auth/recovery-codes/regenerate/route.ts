import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '@/lib/env';
import { requireUserSession } from '@/lib/auth';
import { hashSha256, randomBase64Url } from '@/lib/webauthn';
import { hasValidCsrf, csrfErrorResponse } from '@/lib/csrf';

function createRecoveryCode(): string {
  const raw = randomBase64Url(9).replace(/[^A-Z0-9]/gi, '').toUpperCase();
  const code = raw.slice(0, 10);
  return `${code.slice(0, 5)}-${code.slice(5, 10)}`;
}

export async function POST(request: NextRequest) {
  if (!hasValidCsrf(request as any)) {
    return csrfErrorResponse();
  }

  const env: any = (request as any).env ?? (globalThis as any).__env ?? undefined;
  const db = getDb(env);
  const auth = await requireUserSession(request as any, db);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await db.prepare('DELETE FROM recovery_codes WHERE user_id = ?').run(auth.session.user_id);

  const codes: string[] = [];
  for (let i = 0; i < 10; i += 1) {
    const code = createRecoveryCode();
    codes.push(code);
    await db.prepare(`
      INSERT INTO recovery_codes (id, user_id, code_hash, created_at)
      VALUES (?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    `).run(uuidv4(), auth.session.user_id, hashSha256(code));
  }

  return NextResponse.json({ ok: true, codes });
}
