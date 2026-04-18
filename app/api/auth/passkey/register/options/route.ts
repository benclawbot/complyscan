import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '@/lib/env';
import { requireUserSession } from '@/lib/auth';
import { randomBase64Url, resolveRpId } from '@/lib/webauthn';
import { hasValidCsrf, csrfErrorResponse } from '@/lib/csrf';

export async function POST(request: NextRequest) {
  if (!hasValidCsrf(request as any)) {
    return csrfErrorResponse();
  }

  const env: any = (request as any).env ?? (globalThis as any).__env ?? undefined;
  const db = getDb(env);
  const auth = await requireUserSession(request as any, db);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await db.prepare(`DELETE FROM webauthn_challenges WHERE expires_at <= strftime('%Y-%m-%dT%H:%M:%SZ', 'now')`).run();

  const challenge = randomBase64Url(32);
  const challengeId = uuidv4();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  await db.prepare(`
    INSERT INTO webauthn_challenges (id, user_id, challenge, purpose, expires_at)
    VALUES (?, ?, ?, 'register', ?)
  `).run(challengeId, auth.session.user_id, challenge, expiresAt);

  const credentials = await db.prepare(`
    SELECT credential_id, transports
    FROM passkey_credentials
    WHERE user_id = ?
  `).all(auth.session.user_id) as any[];

  return NextResponse.json({
    challenge,
    rpId: resolveRpId(request),
    rpName: 'ComplyScan',
    user: {
      id: auth.session.user_id,
      name: auth.session.email,
      displayName: auth.session.email,
    },
    challengeId,
    timeout: 60000,
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
    authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
    attestation: 'none',
    excludeCredentials: credentials.map((c) => ({
      id: c.credential_id,
      type: 'public-key',
      transports: c.transports ? JSON.parse(c.transports) : undefined,
    })),
  });
}
