import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDb, getRuntimeEnv } from '@/lib/env';
import { sendReportEmail } from '@/lib/mailjet';

export async function POST(request: NextRequest, { params: _params }: { params: Promise<{ id: string }> }, env: any) {
  try {
    const body = await request.json() as { email?: string };
    const email = String(body?.email || '').trim().toLowerCase();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const runtimeEnv: any = getRuntimeEnv((request as any).env ?? env ?? (globalThis as any).__env ?? undefined);
    const db = getDb(runtimeEnv);
    const appUrl = runtimeEnv?.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://complyscan.pages.dev';

    // Generic response to avoid user enumeration
    const generic = {
      ok: true,
      message: 'If an active agency subscription exists for this email, a secure dashboard link has been sent.',
    };

    // Find active subscriber by email
    const subscriber = await db.prepare(`
      SELECT id, status FROM subscribers WHERE lower(email) = ? AND status = 'active'
    `).get(email) as any;

    if (!subscriber) {
      return NextResponse.json(generic);
    }

    // Get or create subscriber token
    let tokenRecord = await db.prepare(`
      SELECT token FROM subscriber_tokens
      WHERE subscriber_id = ?
      ORDER BY created_at DESC LIMIT 1
    `).get(subscriber.id) as any;

    if (!tokenRecord?.token) {
      const token = crypto.randomBytes(24).toString('hex');
      await db.prepare(`
        INSERT INTO subscriber_tokens (token, subscriber_id, created_at, last_used_at)
        VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), NULL)
      `).run(token, subscriber.id);
      tokenRecord = { token };
    }

    const dashboardUrl = `${appUrl}/dashboard?token=${encodeURIComponent(tokenRecord.token)}`;

    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111;max-width:560px;margin:0 auto">
        <h2 style="margin-bottom:8px">Your ComplyScan Agency Dashboard Link</h2>
        <p style="margin:0 0 12px">Use the secure link below to access your subscriber dashboard.</p>
        <p style="margin:0 0 16px"><a href="${dashboardUrl}" style="display:inline-block;background:#1d4ed8;color:#fff;padding:10px 14px;border-radius:8px;text-decoration:none">Open Dashboard</a></p>
        <p style="margin:0 0 8px;font-size:13px;color:#555">If the button doesn't work, copy and paste this URL:</p>
        <p style="margin:0 0 16px;font-size:13px;word-break:break-all;color:#333">${dashboardUrl}</p>
        <p style="margin:0;font-size:12px;color:#777">If you didn't request this email, you can ignore it.</p>
      </div>
    `;

    try {
      await sendReportEmail({
        email,
        subject: 'Your ComplyScan subscriber dashboard link',
        html,
        name: undefined,
      });
    } catch (mailError: any) {
      console.error('Subscriber login email error:', mailError?.message || mailError);
      return NextResponse.json({ error: 'Unable to send email right now. Please try again.' }, { status: 503 });
    }

    return NextResponse.json(generic);
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}




