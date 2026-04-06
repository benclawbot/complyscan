import { NextRequest, NextResponse } from 'next/server';
import { getDb, getRuntimeEnv, parseResultJson, getStripeSecrets } from '@/lib/env';
import { generateReportHtml } from '@/lib/report';
import { retrieveCheckoutSession } from '@/lib/stripe-api';
import { buildMockScanResult } from '@/lib/mock-scan';

async function getScanResult(db: ReturnType<typeof getDb>, scanId: string) {
  const scan = await db.prepare('SELECT * FROM scans WHERE id = ?').get(scanId) as any;
  if (!scan) return { scan: null, result: null };
  const result = scan.result_json ? await parseResultJson(scan.result_json) : null;
  return { scan, result };
}

async function hydrateMockScanIfNeeded(db: ReturnType<typeof getDb>, scanId: string, sessionId: string | null) {
  if (!sessionId?.startsWith('mock_pdf_')) return null;

  const scan = await db.prepare('SELECT * FROM scans WHERE id = ?').get(scanId) as any;
  if (!scan) return null;
  if (scan.status === 'completed' && scan.result_json) {
    return getScanResult(db, scanId);
  }

  const result = buildMockScanResult(scan.url || 'https://example.com');
  await db.prepare(`
    UPDATE scans
    SET status = 'completed', result_json = ?, completed_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
    WHERE id = ?
  `).run(JSON.stringify(result), scanId);

  return getScanResult(db, scanId);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: scanId } = await params;
  const sessionId = request.nextUrl.searchParams.get('session_id');
  const env: any = getRuntimeEnv((request as any).env ?? (globalThis as any).__env ?? undefined);
  const db = getDb(env);

  let { scan, result } = await getScanResult(db, scanId);

  const mockHydrated = await hydrateMockScanIfNeeded(db, scanId, sessionId);
  if (mockHydrated) {
    scan = mockHydrated.scan;
    result = mockHydrated.result;
  }

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

  if (sessionId) {
    if (sessionId.startsWith('mock_pdf_')) {
      const refreshed = await hydrateMockScanIfNeeded(db, scanId, sessionId);
      if (refreshed?.result) {
        return NextResponse.json({
          reportHtml: generateReportHtml(refreshed.scan?.url || '', refreshed.result),
          url: refreshed.scan?.url || '',
        });
      }
    }

    const stripeSecrets = getStripeSecrets(request as any);
    if (stripeSecrets) {
      try {
        const session = await retrieveCheckoutSession(sessionId, stripeSecrets.STRIPE_SECRET_KEY);
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
  }

  return NextResponse.json({ error: 'Scan not yet complete' }, { status: 202 });
}
