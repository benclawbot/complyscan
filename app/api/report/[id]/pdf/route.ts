import { NextRequest, NextResponse } from 'next/server';
import { getDb, getRuntimeEnv, parseResultJson } from '@/lib/env';
import { generatePDF } from '@/lib/report-pdf';
import { generateReportHtml } from '@/lib/report';
import { buildMockScanResult } from '@/lib/mock-scan';
import { getBearerToken, verifySubscriberToken, getUserSession, touchSubscriberToken, touchUserSession } from '@/lib/auth';
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

  const token = getBearerToken(request) || request.cookies.get('session_token')?.value || request.cookies.get('session')?.value || null;
  let branding: any = null;

  if (token) {
    const sub = await verifySubscriberToken(db, token);
    if (sub) {
      await touchSubscriberToken(db, token);
      const authorized = !scan.subscriber_id || scan.subscriber_id === sub.subscriber_id || scan.email === sub.email;
      if (!authorized) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      branding = await getBranding(db, { type: 'subscriber', id: sub.subscriber_id });
    } else {
      const user = await getUserSession(db, token);
      if (user) {
        await touchUserSession(db, token);
        const authorized = !scan.user_id || scan.user_id === user.user_id || scan.email === user.email;
        if (!authorized) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        branding = await getBranding(db, { type: 'user', id: user.user_id });

        // If not a subscriber scan, enforce unlock with credits for PDF generation.
        if (!scan.subscriber_id) {
          const unlocked = await hasUnlockedReport(db, scanId);
          if (!unlocked) {
            const ok = await unlockReportWithCredit(db, user.user_id, scanId);
            if (!ok) {
              return NextResponse.json(
                { error: 'Payment required', code: 'NO_CREDITS', credits: Number(user.credits ?? 0) },
                { status: 402 }
              );
            }
          }
        }
      }
    }
  }

  // Without auth, only subscribers can access PDFs. (Users must claim the scan and spend credits.)
  if (!token && !scan.subscriber_id) {
    return NextResponse.json({ error: 'Payment required', code: 'UNAUTHORIZED' }, { status: 401 });
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


