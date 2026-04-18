import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { getDb } from '@/lib/env';
import { hashSha256, normalizeEmail } from '@/lib/webauthn';
import { hasValidCsrf, csrfErrorResponse, setCsrfCookie } from '@/lib/csrf';

interface Body {
  email?: string;
  code?: string;
  newPassword?: string;
}

export async function POST(request: NextRequest) {
  if (!hasValidCsrf(request as any)) {
    return csrfErrorResponse();
  }

  const body = await request.json() as Body;
  const email = normalizeEmail(body.email || '');
  const code = String(body.code || '').trim().toUpperCase();
  const newPassword = String(body.newPassword || '');

  if (!email || !code || !newPassword) {
    return NextResponse.json({ error: 'Email, recovery code, and new password are required' }, { status: 400 });
  }

  if (newPassword.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }

  const env: any = (request as any).env ?? (globalThis as any).__env ?? undefined;
  const db = getDb(env);

  const user = await db.prepare('SELECT id FROM users WHERE lower(email) = ?').get(email) as any;
  if (!user) {
    return NextResponse.json({ error: 'Invalid recovery request' }, { status: 401 });
  }

  const row = await db.prepare(`
    SELECT id FROM recovery_codes
    WHERE user_id = ? AND code_hash = ? AND used_at IS NULL
    LIMIT 1
  `).get(user.id, hashSha256(code)) as any;

  if (!row) {
    return NextResponse.json({ error: 'Invalid or already used recovery code' }, { status: 401 });
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(newPassword, salt, 64).toString('hex');
  const passwordHash = `${salt}:${hash}`;

  await db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, user.id);
  await db.prepare('UPDATE recovery_codes SET used_at = strftime(\'%Y-%m-%dT%H:%M:%SZ\', \'now\') WHERE id = ?').run(row.id);

  const token = uuidv4();
  await db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, user.id);

  const response = NextResponse.json({ ok: true });
  response.cookies.set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  });
  setCsrfCookie(response);

  return response;
}
