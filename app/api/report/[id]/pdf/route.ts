import { NextRequest, NextResponse } from 'next/server';
import { getDb, getRuntimeEnv, parseResultJson, getStripeSecrets } from '@/lib/env';
import { getBearerToken, verifySubscriberToken } from '@/lib/auth';
import { retrieveCheckoutSession } from '@/lib/stripe-api';
import { buildMockScanResult } from '@/lib/mock-scan';

function buildMockPdfBuffer(url: string, scanId: string): Buffer {
  const lines = [
    '%PDF-1.4',
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj',
  ];
  const text = `BT /F1 18 Tf 72 720 Td (ComplyScan Mock PDF Report) Tj 0 -28 Td /F1 12 Tf (${url.replace(/[()\\]/g, '\\$&')}) Tj 0 -20 Td (Scan ID: ${scanId.replace(/[()\\]/g, '\\$&')}) Tj 0 -20 Td (This is a mock PDF generated for runtime verification.) Tj ET`;
  lines.push(`4 0 obj << /Length ${text.length} >> stream\n${text}\nendstream endobj`);
  lines.push('5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj');
  const offsets = [];
  let body = '';
  for (const line of lines) {
    offsets.push(body.length);
    body += line + '\n';
  }
  const xrefOffset = body.length;
  body += `xref\n0 ${lines.length + 1}\n`;
  body += '0000000000 65535 f \n';
  for (const off of offsets) {
    body += `${String(off).padStart(10, '0')} 00000 n \n`;
  }
  body += `trailer << /Size ${lines.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(body, 'utf8');
}

async function getScanWithResult(scanId: string, db: ReturnType<typeof getDb>) {
  const scan = await db.prepare('SELECT * FROM scans WHERE id = ?').get(scanId) as any;
  if (!scan || scan.status !== 'completed' || !scan.result_json) return null;
  const result = await parseResultJson(scan.result_json);
  if (!result) return null;
  return { scan, result };
}

async function hydrateMockScanIfNeeded(scanId: string, db: ReturnType<typeof getDb>, sessionId: string | null) {
  if (!sessionId?.startsWith('mock_pdf_')) return null;
  const scan = await db.prepare('SELECT * FROM scans WHERE id = ?').get(scanId) as any;
  if (!scan) return null;
  if (scan.status === 'completed' && scan.result_json) return getScanWithResult(scanId, db);

  const result = buildMockScanResult(scan.url || 'https://example.com', true);
  await db.prepare(`
    UPDATE scans
    SET status = 'completed', result_json = ?, completed_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
    WHERE id = ?
  `).run(JSON.stringify(result), scanId);
  return getScanWithResult(scanId, db);
}

async function isSubscriberAuthorized(request: NextRequest, db: ReturnType<typeof getDb>, scanId: string) {
  const token = request.nextUrl.searchParams.get('token') || getBearerToken(request) || request.cookies.get('session_token')?.value || request.cookies.get('session')?.value;
  if (!token) return false;
  const subscriber = await verifySubscriberToken(db, token);
  if (!subscriber) return false;
  const scan = await db.prepare('SELECT subscriber_id FROM scans WHERE id = ?').get(scanId) as any;
  return Boolean(scan?.subscriber_id && scan.subscriber_id === subscriber.subscriber_id);
}

async function isPaidSessionValid(request: NextRequest, sessionId: string | null, scanId: string) {
  if (!sessionId) return false;
  if (sessionId.startsWith('mock_pdf_')) return sessionId.endsWith(scanId);
  const stripeSecrets = getStripeSecrets(request as any);
  if (!stripeSecrets) return false;

  try {
    const session = await retrieveCheckoutSession(sessionId, stripeSecrets.STRIPE_SECRET_KEY);
    return session.payment_status === 'paid' && session.metadata?.scanId === scanId;
  } catch {
    return false;
  }
}

async function generateFromResult(result: any, scanId: string, format: string, sessionId?: string | null) {
  const url = result?.crawl?.url || result?.url || '';

  if (format === 'html') {
    const { generateReportHtml } = await import('@/lib/report');
    const html = generateReportHtml(url, result);
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
        'Content-Disposition': `inline; filename="GDPR-Report-${scanId}.html"`,
      },
    });
  }

  const pdfBuffer = sessionId?.startsWith('mock_pdf_')
    ? buildMockPdfBuffer(url, scanId)
    : await (await import('@/lib/pdf-report')).generateReportPdfBuffer(url, result);
  const safeName = (url || 'report').replace(/[^a-zA-Z0-9.-]/g, '_').slice(0, 60);
  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="GDPR-Report-${safeName}.pdf"`,
      'Content-Length': String(pdfBuffer.length),
    },
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: scanId } = await params;
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') || 'pdf';

  let result: any;
  try {
    result = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (format !== 'html') {
    return NextResponse.json({ error: 'POST PDF generation is not allowed' }, { status: 403 });
  }

  return generateFromResult(result, scanId, 'html', request.nextUrl.searchParams.get('session_id'));
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: scanId } = await params;
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') || 'pdf';
  const sessionId = searchParams.get('session_id');
  const env: any = getRuntimeEnv((request as any).env ?? (globalThis as any).__env ?? undefined);
  const db = getDb(env);

  let data = await getScanWithResult(scanId, db);
  if (!data) {
    data = await hydrateMockScanIfNeeded(scanId, db, sessionId);
  }
  if (!data) {
    return NextResponse.json({ error: 'Report not ready. Scan may still be processing.' }, { status: 404 });
  }

  if (format === 'html') {
    return generateFromResult(data.result, scanId, 'html', sessionId);
  }

  const subscriberAuthorized = await isSubscriberAuthorized(request, db, scanId);
  const paidSessionAuthorized = await isPaidSessionValid(request, sessionId, scanId);
  if (!subscriberAuthorized && !paidSessionAuthorized) {
    return NextResponse.json({ error: 'PDF not purchased. Please upgrade to access the full report.' }, { status: 403 });
  }

  return generateFromResult(data.result, scanId, 'pdf', sessionId);
}







