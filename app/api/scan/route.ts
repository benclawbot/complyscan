import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb, getRuntimeEnv, sendScanJob } from '@/lib/env';

export async function POST(request: NextRequest, { params: _params }: { params: Promise<{ id: string }> }, env: any) {
  env = getRuntimeEnv(env);
  let scanId: string | undefined;
  let db: ReturnType<typeof getDb> | undefined;

  try {
    const body = await request.json() as { url?: string; email?: string };
    const { url, email } = body;

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Invalid protocol');
      }
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    scanId = uuidv4();
    db = getDb(env);

    await db.prepare(`
      INSERT INTO scans (id, url, email, status)
      VALUES (?, ?, ?, 'pending')
    `).run(scanId, url, email || null);

    if (!env?.SCAN_QUEUE) {
      await db.prepare(`UPDATE scans SET status = 'failed' WHERE id = ?`).run(scanId);
      return NextResponse.json({ error: 'Scan queue is not configured' }, { status: 500 });
    }

    await sendScanJob({ scanId, url, email, trigger: 'free' }, env);

    return NextResponse.json({
      scanId,
      status: 'queued',
    });
  } catch (error: any) {
    // Only reaches here for truly unexpected errors (JSON parse, DB init, etc.)
    if (db && scanId) {
      await db!.prepare(`UPDATE scans SET status = 'failed' WHERE id = ?`).run(scanId!);
    }
    console.error('Unexpected scan error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}



