import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '@/lib/env';
import { normalizeEmail, randomBase64Url, resolveRpId } from '@/lib/webauthn';
import { hasValidCsrf, csrfErrorResponse } from '@/lib/csrf';

export async function POST(request: NextRequest) {
  if (!hasValidCsrf(request as any)) {
    return csrfErrorResponse();
  }

  const body = await request.json() as { email?: string };
  const email = normalizeEmail(body.email || '');
  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  const env: any = (request as any).env ?? (globalThis as any).__env ?? undefined;
  const db = getDb(env);

  const user = await db.prepare('SELECT id FROM users WHERE lower(email) = ?').get(email) as any;
  if (!user) {
    return NextResponse.json({ error: 'Passkey not found for this account' }, { status: 404 });
  }

  const credentials = await db.prepare(`
    SELECT credential_id, transports
    FROM passkey_credentials
    WHERE user_id = ?
  `).all(user.id) as any[];

  if (!credentials.length) {
    return NextResponse.json({ error: 'No passkeys configured for this account' }, { status: 404 });
  }

  const challenge = randomBase64Url(32);
  const challengeId = uuidv4();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  await db.prepare(`
    INSERT INTO webauthn_challenges (id, user_id, challenge, purpose, expires_at)
    VALUES (?, ?, ?, 'login', ?)
  `).run(challengeId, user.id, challenge, expiresAt);

  return NextResponse.json({
    challenge,
    challengeId,
    rpId: resolveRpId(request),
    timeout: 60000,
    userVerification: 'preferred',
    allowCredentials: credentials.map((c) => ({
      id: c.credential_id,
      type: 'public-key',
      transports: c.transports ? JSON.parse(c.transports) : undefined,
    })),
  });
}
