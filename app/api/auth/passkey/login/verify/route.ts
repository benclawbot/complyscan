import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '@/lib/env';
import { decodeBase64UrlJson, normalizeEmail } from '@/lib/webauthn';
import { hasValidCsrf, csrfErrorResponse, setCsrfCookie } from '@/lib/csrf';

interface Body {
  email?: string;
  challengeId?: string;
  credentialId?: string;
  clientDataJSON?: string;
  signature?: string;
  authenticatorData?: string;
  userHandle?: string | null;
}

export async function POST(request: NextRequest) {
  if (!hasValidCsrf(request as any)) {
    return csrfErrorResponse();
  }

  const body = await request.json() as Body;
  const email = normalizeEmail(body.email || '');
  const challengeId = String(body.challengeId || '').trim();
  const credentialId = String(body.credentialId || '').trim();
  const clientDataJSON = String(body.clientDataJSON || '').trim();

  if (!email || !challengeId || !credentialId || !clientDataJSON) {
    return NextResponse.json({ error: 'Missing passkey payload' }, { status: 400 });
  }

  const env: any = (request as any).env ?? (globalThis as any).__env ?? undefined;
  const db = getDb(env);

  const user = await db.prepare('SELECT id FROM users WHERE lower(email) = ?').get(email) as any;
  if (!user) {
    return NextResponse.json({ error: 'Invalid passkey login attempt' }, { status: 401 });
  }

  const challengeRow = await db.prepare(`
    SELECT id, challenge, user_id, expires_at
    FROM webauthn_challenges
    WHERE id = ? AND purpose = 'login'
  `).get(challengeId) as any;

  if (!challengeRow || challengeRow.user_id !== user.id || Date.parse(challengeRow.expires_at) < Date.now()) {
    return NextResponse.json({ error: 'Invalid or expired challenge' }, { status: 400 });
  }

  const credential = await db.prepare(`
    SELECT id, user_id, counter
    FROM passkey_credentials
    WHERE credential_id = ?
  `).get(credentialId) as any;

  if (!credential || credential.user_id !== user.id) {
    return NextResponse.json({ error: 'Unknown passkey credential' }, { status: 401 });
  }

  let challengeFromClient = '';
  try {
    const parsed = decodeBase64UrlJson<{ challenge?: string }>(clientDataJSON);
    challengeFromClient = String(parsed.challenge || '');
  } catch {
    return NextResponse.json({ error: 'Invalid clientDataJSON' }, { status: 400 });
  }

  if (challengeFromClient !== challengeRow.challenge) {
    return NextResponse.json({ error: 'Challenge mismatch' }, { status: 400 });
  }

  const nextCounter = Number(credential.counter || 0) + 1;
  await db.prepare(`
    UPDATE passkey_credentials
    SET counter = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
    WHERE id = ?
  `).run(nextCounter, credential.id);

  await db.prepare(`DELETE FROM webauthn_challenges WHERE id = ?`).run(challengeId);

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
