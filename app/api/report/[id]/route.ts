import { NextRequest, NextResponse } from 'next/server';
import { getDb, parseResultJson } from '@/lib/env';
import { generateReportHtml } from '@/lib/report';
import { retrieveCheckoutSession } from '@/lib/stripe-api';

async function getScanResult(db: ReturnType<typeof getDb>, scanId: string) {
  const scan = await db.prepare('SELECT * FROM scans WHERE id = ?').get(scanId) as any;
  if (!scan) return { scan: null, result: null };
  const result = scan.result_json ? await parseResultJson(scan.result_json) : null;
  return { scan, result };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: scanId } = await params;
  const sessionId = request.nextUrl.searchParams.get('session_id');
  const env: any = (request as any).env ?? (globalThis as any).__env ?? undefined;
  const db = getDb(env);

  const { scan, result } = await getScanResult(db, scanId);

  if (result && scan?.status === 'completed') {
    return NextResponse.json({ reportHtml: generateReportHtml(scan.url || '', result), url: scan.url || '' });
  }

  if (!scan && !sessionId) {
    return NextResponse.json({ error: 'Scan not found' }, { status: 404 });
  }

  if (scan?.status === 'pending' || scan?.status === 'processing') {
    return NextResponse.json({ error: 'Scan not yet complete' }, { status: 202 });
  }

  if (scan?.status === 'failed') {
    return NextResponse.json({ error: 'Scan failed. Please try again.' }, { status: 500 });
  }

  if (sessionId && process.env.STRIPE_SECRET_KEY) {
    try {
      const session = await retrieveCheckoutSession(sessionId);
      const stripeScanId = session.metadata?.scanId;
      if (stripeScanId && stripeScanId === scanId) {
        const refreshed = await getScanResult(db, scanId);
        if (refreshed.result) {
          return NextResponse.json({
            reportHtml: generateReportHtml(refreshed.scan?.url || '', refreshed.result),
            url: refreshed.scan?.url || '',
          });
        }
      }
    } catch (error: any) {
      console.error('Stripe session retrieve failed:', error.message);
    }
  }

  return NextResponse.json({ error: 'Scan not yet complete' }, { status: 202 });
}
