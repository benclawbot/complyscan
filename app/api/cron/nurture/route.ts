/**
 * Cron: Nurture email sequences
 * Run weekly: sends Day-7 upgrade email to free-scan users who haven't upgraded.
 * Secured via CRON_SECRET environment variable (Cloudflare Pages cron trigger).
 * Cloudflare Pages sets X-Cootie-Secret header for cron triggers — verify against CRON_SECRET.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/env';

export async function GET(request: NextRequest, { params: _params }: { params: Promise<{ id: string }> }, env: any) {
  // Verify cron secret (Cloudflare Pages sets X-Cootie-Secret header for cron triggers)
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }
  const cootieSecret = request.headers.get('x-cootie-secret');
  if (!cootieSecret || cootieSecret !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb(env);

  // Find free-scan users (no subscriber record) who signed up in the last 7 days
  // and have not been sent the upgrade email yet
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const users = await db.prepare(`
    SELECT DISTINCT u.email
    FROM users u
    JOIN scans s ON s.email = u.email
    WHERE s.stripe_session_id IS NULL
      AND u.created_at >= ?
      AND u.email NOT IN (
        SELECT email FROM subscriber_tokens
      )
    GROUP BY u.email
    HAVING COUNT(s.id) >= 1
  `).all(sevenDaysAgo.toISOString()) as { email: string }[];

  let sent = 0;
  let failed = 0;

  for (const { email } of users) {
    try {
      const { sendUpgradeEmail } = await import('@/lib/mailjet');
      await sendUpgradeEmail(email);
      sent++;
    } catch {
      failed++;
    }
  }

  return NextResponse.json({
    ok: true,
    message: `Nurture cron complete: ${sent} upgrade emails sent, ${failed} failed`,
    usersFound: users.length,
  });
}

