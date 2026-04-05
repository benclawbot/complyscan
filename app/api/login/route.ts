import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/env';

export async function POST(request: NextRequest, { params: _params }: { params: Promise<{ id: string }> }, env: any) {
  try {
    const body = await request.json() as { email?: string };
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const db = getDb(env);

    // Find active subscriber by email
    const subscriber = await db.prepare(`
      SELECT id, status FROM subscribers WHERE email = ? AND status = 'active'
    `).get(email) as any;

    if (!subscriber) {
      return NextResponse.json({ notFound: true }, { status: 200 });
    }

    // Get the latest token for this subscriber
    const tokenRecord = await db.prepare(`
      SELECT token FROM subscriber_tokens
      WHERE subscriber_id = ?
      ORDER BY last_used_at DESC LIMIT 1
    `).get(subscriber.id) as any;

    if (!tokenRecord) {
      return NextResponse.json({ notFound: true }, { status: 200 });
    }

    // NEXT_PUBLIC_APP_URL must be set in Cloudflare Pages environment variables
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) {
      return NextResponse.json({ error: 'NEXT_PUBLIC_APP_URL not configured' }, { status: 500 });
    }
    const dashboardUrl = `${appUrl}/dashboard?token=${tokenRecord.token}`;

    return NextResponse.json({ dashboardUrl });
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

