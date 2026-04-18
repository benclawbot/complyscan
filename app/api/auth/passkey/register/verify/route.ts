import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '@/lib/env';
import { requireUserSession } from '@/lib/auth';
import { decodeBase64UrlJson } from '@/lib/webauthn';
import { hasValidCsrf, csrfErrorResponse } from '@/lib/csrf';

interface Body {
  challengeId?: string;
  credentialId?: string;
  publicKey?: string;
  counter?: number;
  transports?: string[];
  clientDataJSON?: string;
}

export async function POST(request: NextRequest) {
  if (!hasValidCsrf(request as any)) {
    return csrfErrorResponse();
  }

  const body = await request.json() as Body;
  const env: any = (request as any).env ?? (globalThis as any).__env ?? undefined;
  const db = getDb(env);
  const auth = await requireUserSession(request as any, db);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const challengeId = String(body.challengeId || '').trim();
  const credentialId = String(body.credentialId || '').trim();
  const publicKey = String(body.publicKey || '').trim();
  const clientDataJSON = String(body.clientDataJSON || '').trim();

  if (!challengeId || !credentialId || !publicKey || !clientDataJSON) {
    return NextResponse.json({ error: 'Missing passkey payload' }, { status: 400 });
  }

  const challengeRow = await db.prepare(`
    SELECT id, challenge, user_id, expires_at
    FROM webauthn_challenges
    WHERE id = ? AND purpose = 'register'
  `).get(challengeId) as any;

  if (!challengeRow || challengeRow.user_id !== auth.session.user_id || Date.parse(challengeRow.expires_at) < Date.now()) {
    return NextResponse.json({ error: 'Invalid or expired challenge' }, { status: 400 });
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

  const existing = await db.prepare(`SELECT id FROM passkey_credentials WHERE credential_id = ?`).get(credentialId) as any;
  if (existing) {
    await db.prepare(`DELETE FROM webauthn_challenges WHERE id = ?`).run(challengeId);
    return NextResponse.json({ ok: true });
  }

  await db.prepare(`
    INSERT INTO passkey_credentials (id, user_id, credential_id, public_key, counter, transports, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
  `).run(
    uuidv4(),
    auth.session.user_id,
    credentialId,
    publicKey,
    Number(body.counter || 0),
    body.transports ? JSON.stringify(body.transports) : null,
  );

  await db.prepare(`DELETE FROM webauthn_challenges WHERE id = ?`).run(challengeId);

  return NextResponse.json({ ok: true });
}
