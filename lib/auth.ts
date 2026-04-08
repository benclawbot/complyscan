import { DbClient } from '@/lib/env';

export function getBearerToken(request: Request): string | null {
  const header = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!header) return null;
  return header.startsWith('Bearer ') ? header.slice(7).trim() : null;
}

export async function getSubscriberTokenRecord(db: DbClient, token: string) {
  return await db.prepare(`
    SELECT st.token, st.subscriber_id, st.expires_at, st.created_at, st.last_used_at,
           s.email, s.plan, s.status, s.current_period_end, s.cancel_at_period_end
    FROM subscriber_tokens st
    JOIN subscribers s ON s.id = st.subscriber_id
    WHERE st.token = ?
  `).get(token) as any;
}

export async function verifySubscriberToken(db: DbClient, token: string, requiredPlan?: 'agency') {
  const rec = await getSubscriberTokenRecord(db, token);
  if (!rec) return null;
  if (rec.status !== 'active') return null;
  if (rec.expires_at && new Date(rec.expires_at) < new Date()) return null;
  if (requiredPlan && rec.plan !== requiredPlan) return null;
  return rec;
}

export async function touchSubscriberToken(db: DbClient, token: string) {
  await db.prepare(`
    UPDATE subscriber_tokens
    SET last_used_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
    WHERE token = ?
  `).run(token);
}

export async function getUserSession(db: DbClient, token: string) {
  try {
    return await db.prepare(`
      SELECT s.token, s.user_id, u.email, u.credits
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token = ?
    `).get(token) as any;
  } catch (err: any) {
    const message = String(err?.message || err || '');
    const missingCreditsColumn = /no such column: u\.credits/i.test(message) || /no such column.*credits/i.test(message);
    if (!missingCreditsColumn) throw err;

    const row = await db.prepare(`
      SELECT s.token, s.user_id, u.email
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token = ?
    `).get(token) as any;

    if (!row) return null;
    return { ...row, credits: 0 };
  }
}

export async function touchUserSession(db: DbClient, token: string) {
  try {
    await db.prepare(`
      UPDATE sessions
      SET last_used_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
      WHERE token = ?
    `).run(token);
  } catch (err: any) {
    const message = String(err?.message || err || '');
    const missingLastUsed = /no such column: last_used_at/i.test(message) || /no such column.*last_used_at/i.test(message);
    if (!missingLastUsed) throw err;
    // Backward-compat for older DB schemas: ignore touch update when column is absent.
  }
}
