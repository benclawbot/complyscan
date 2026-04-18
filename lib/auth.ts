import { DbClient } from '@/lib/env';

export function getBearerToken(request: Request): string | null {
  const header = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!header) return null;
  return header.startsWith('Bearer ') ? header.slice(7).trim() : null;
}

export function getSessionToken(request: Request & { cookies?: { get(name: string): { value: string } | undefined } }): string | null {
  return getBearerToken(request) || request.cookies?.get('session')?.value || null;
}

function isPast(isoValue?: string | null): boolean {
  if (!isoValue) return false;
  const ts = Date.parse(isoValue);
  if (Number.isNaN(ts)) return false;
  return ts < Date.now();
}

function isSubscriberAccessExpired(rec: any): boolean {
  if (!rec) return true;
  const cancellationReachedEnd = Boolean(rec.cancel_at_period_end) && isPast(rec.current_period_end);
  return cancellationReachedEnd;
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
  }
}

export async function getActiveSubscriberForUser(db: DbClient, userId: string, requiredPlan?: 'agency') {
  const subscriber = await db.prepare(`
    SELECT id, user_id, email, plan, status, current_period_end, cancel_at_period_end
    FROM subscribers
    WHERE user_id = ?
    ORDER BY updated_at DESC
    LIMIT 1
  `).get(userId) as any;

  if (!subscriber) return null;
  if (subscriber.status !== 'active') return null;
  if (requiredPlan && subscriber.plan !== requiredPlan) return null;
  if (isSubscriberAccessExpired(subscriber)) return null;
  return subscriber;
}

export async function revokeSession(db: DbClient, token: string) {
  await db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

export async function requireUserSession(
  request: Request & { cookies?: { get(name: string): { value: string } | undefined } },
  db: DbClient
) {
  const token = getSessionToken(request);
  if (!token) return null;
  const session = await getUserSession(db, token);
  if (!session) return null;
  await touchUserSession(db, token);
  return { token, session };
}

export async function requireAgencySession(
  request: Request & { cookies?: { get(name: string): { value: string } | undefined } },
  db: DbClient
) {
  const auth = await requireUserSession(request, db);
  if (!auth) return null;
  const subscriber = await getActiveSubscriberForUser(db, auth.session.user_id, 'agency');
  if (!subscriber) return null;
  return { ...auth, subscriber };
}
