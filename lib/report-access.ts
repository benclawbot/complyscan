import type { DbClient } from './env';

export async function hasUnlockedReport(db: DbClient, scanId: string): Promise<boolean> {
  const row = await db.prepare('SELECT scan_id FROM report_purchases WHERE scan_id = ?').get(scanId) as any;
  return Boolean(row?.scan_id);
}

export async function unlockReportWithCredit(db: DbClient, userId: string, scanId: string): Promise<boolean> {
  // 1. If already unlocked, no-op.
  if (await hasUnlockedReport(db, scanId)) return true;

  // 2. Atomically decrement credits if possible.
  const res = await db.prepare(`UPDATE users SET credits = credits - 1 WHERE id = ? AND credits > 0`).run(userId) as any;
  const changes = Number(res?.changes ?? res?.meta?.changes ?? 0);
  if (changes <= 0) return false;

  // 3. Mark scan unlocked (unique index on scan_id prevents duplicates).
  const id = `unlock_${scanId}`;
  await db.prepare(`
    INSERT OR IGNORE INTO report_purchases (id, scan_id, user_id, stripe_payment_intent, purchased_at)
    VALUES (?, ?, ?, NULL, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
  `).run(id, scanId, userId);

  return true;
}

