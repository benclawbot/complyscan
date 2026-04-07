import { NextRequest, NextResponse } from 'next/server';
import { getDb, getRuntimeEnv, parseResultJson, getStripeSecrets } from '@/lib/env';
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
  const env: any = getRuntimeEnv((request as any).env ?? (globalThis as any).__env ?? undefined);
  const db = getDb(env);

  const { scan, result } = await getScanResult(db, scanId);

  if (result && scan?.status === 'completed') {
    const fullReport = Boolean(sessionId);
    return NextResponse.json({ reportHtml: generateReportHtml(scan.url || '', result, fullReport), url: scan.url || '' });
  }

  if (!scan) {
    return NextResponse.json({ error: 'Scan not found' }, { status: 404 });
  }

  if (scan.status === 'pending' || scan.status === 'processing') {
    return NextResponse.json({ error: 'Scan not yet complete' }, { status: 202 });
  }

  if (scan.status === 'failed') {
    return NextResponse.json({ error: 'Scan failed. Please try again.' }, { status: 500 });
  }

  if (sessionId) {
    const stripeSecrets = getStripeSecrets(request as any);
    if (stripeSecrets) {
      try {
        const session = await retrieveCheckoutSession(sessionId, stripeSecrets.STRIPE_SECRET_KEY);
        const stripeScanId = session.metadata?.scanId;
        if (stripeScanId && stripeScanId === scanId) {
          const refreshed = await getScanResult(db, scanId);
          if (refreshed.result) {
            return NextResponse.json({
              reportHtml: generateReportHtml(refreshed.scan?.url || '', refreshed.result, true),
              url: refreshed.scan?.url || '',
            });
          }
        }
      } catch (error: any) {
        console.error('Stripe session retrieve failed:', error.message);
      }
    }
  }

  return NextResponse.json({ error: 'Scan not yet complete' }, { status: 202 });
}