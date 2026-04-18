import { NextRequest, NextResponse } from 'next/server';
import { getDb, getRuntimeEnv, parseResultJson } from '@/lib/env';
import { generatePDF } from '@/lib/report-pdf';
import { generateReportHtml } from '@/lib/report';
import { buildMockScanResult } from '@/lib/mock-scan';
import { requireUserSession, getActiveSubscriberForUser } from '@/lib/auth';
import { getBranding } from '@/lib/branding';
import { hasUnlockedReport, unlockReportWithCredit } from '@/lib/report-access';

async function getScanResult(db: ReturnType<typeof getDb>, scanId: string) {
  const scan = await db.prepare('SELECT * FROM scans WHERE id = ?').get(scanId) as any;
  if (!scan) return { scan: null, result: null };
  const result = scan.result_json ? await parseResultJson(scan.result_json) : null;
  return { scan, result };
}

function pdfResponse(pdf: Buffer, fileBase: string) {
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${fileBase}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}

function htmlFallbackResponse(html: string, fileBase: string) {
  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `inline; filename="${fileBase}.html"`,
      'Cache-Control': 'no-store',
      'X-ComplyScan-PDF-Fallback': '1',
    },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: scanId } = await params;

  if (scanId === 'test') {
    const url = request.nextUrl.searchParams.get('url') || 'https://example.com';
    const mockResult = buildMockScanResult(url, true);
    const pdf = await generatePDF({ url, result: mockResult as any, fullReport: true });
    return pdfResponse(pdf, 'gdpr-report-test');
  }

  const env: any = getRuntimeEnv((request as any).env ?? (globalThis as any).__env ?? undefined);
  const db = getDb(env);
  const { scan, result } = await getScanResult(db, scanId);

  if (!scan) {
    return NextResponse.json({ error: 'Scan not found' }, { status: 404 });
  }

  if (scan.status === 'pending' || scan.status === 'processing' || !result) {
    return NextResponse.json({ error: 'Scan not yet complete' }, { status: 202 });
  }

  if (scan.status === 'failed') {
    return NextResponse.json({ error: 'Scan failed. Please try again.' }, { status: 500 });
  }

  const auth = await requireUserSession(request as any, db);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const subscriber = await getActiveSubscriberForUser(db, auth.session.user_id);
  const authorizedByUser = Boolean(scan.user_id) && scan.user_id === auth.session.user_id;
  const authorizedBySubscriber = Boolean(subscriber?.id) && Boolean(scan.subscriber_id) && scan.subscriber_id === subscriber.id;
  const authorizedByEmail = Boolean(scan.email) && scan.email === auth.session.email;

  if (!authorizedByUser && !authorizedBySubscriber && !authorizedByEmail) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let branding: any = null;
  if (authorizedBySubscriber && subscriber) {
    branding = await getBranding(db, { type: 'subscriber', id: subscriber.id });
  } else {
    branding = await getBranding(db, { type: 'user', id: auth.session.user_id });

    if (!scan.subscriber_id) {
      const unlocked = await hasUnlockedReport(db, scanId);
      if (!unlocked) {
        const ok = await unlockReportWithCredit(db, auth.session.user_id, scanId);
        if (!ok) {
          return NextResponse.json(
            { error: 'Payment required', code: 'NO_CREDITS', credits: Number(auth.session.credits ?? 0) },
            { status: 402 }
          );
        }
      }
    }
  }

  const fileBase = `gdpr-report-${scanId}`;

  try {
    const pdf = await generatePDF({
      url: scan.url || '',
      result: result as any,
      fullReport: true,
      branding: branding ?? undefined,
      env,
    });
    return pdfResponse(pdf, fileBase);
  } catch (error: any) {
    console.error('PDF generation failed, serving printable HTML fallback:', error?.message || error);
    const html = generateReportHtml(scan.url || '', result as any, true, branding ?? undefined);
    return htmlFallbackResponse(html, fileBase);
  }
}
