import { NextRequest, NextResponse } from 'next/server';
import { getDb, getRuntimeEnv, parseResultJson, getStripeSecrets } from '@/lib/env';
import { getBearerToken, verifySubscriberToken } from '@/lib/auth';
import { retrieveCheckoutSession } from '@/lib/stripe-api';

async function getScanWithResult(scanId: string, db: ReturnType<typeof getDb>) {
  const scan = await db.prepare('SELECT * FROM scans WHERE id = ?').get(scanId) as any;
  if (!scan || scan.status !== 'completed' || !scan.result_json) return null;
  const result = await parseResultJson(scan.result_json);
  if (!result) return null;
  return { scan, result };
}

async function isSubscriberAuthorized(request: NextRequest, db: ReturnType<typeof getDb>, scanId: string) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '') || getBearerToken(request) || request.cookies.get('session_token')?.value || request.cookies.get('session')?.value;
  if (!token) return false;
  const subscriber = await verifySubscriberToken(db, token);
  if (!subscriber) return false;
  const scan = await db.prepare('SELECT subscriber_id FROM scans WHERE id = ?').get(scanId) as any;
  return Boolean(scan?.subscriber_id && scan.subscriber_id === subscriber.subscriber_id);
}

// Check if a Stripe session was stored for this scan (webhook has fired)
async function isStoredSessionValid(db: ReturnType<typeof getDb>, scanId: string, sessionId: string | null) {
  if (!sessionId) return false;
  const scan = await db.prepare('SELECT stripe_session_id FROM scans WHERE id = ?').get(scanId) as any;
  if (!scan?.stripe_session_id) return false;
  if (scan.stripe_session_id === sessionId) return true;
  return false;
}

async function isPaidSessionValid(request: NextRequest, sessionId: string | null, scanId: string, db: ReturnType<typeof getDb>) {
  if (!sessionId) return false;

  const stripeSecrets = getStripeSecrets(request as any);

  // If webhook has stored a session and it matches, allow (webhook confirms payment)
  if (await isStoredSessionValid(db, scanId, sessionId)) return true;

  // Fall back to Stripe API to verify session is paid
  if (stripeSecrets) {
    try {
      const session = await retrieveCheckoutSession(sessionId, stripeSecrets.STRIPE_SECRET_KEY);
      return (session.payment_status === 'paid' || session.payment_status === 'pending')
        && session.metadata?.scanId === scanId;
    } catch {
      return false;
    }
  }

  return false;
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

  const pdfBuffer = await (await import('@/lib/pdf-report')).generateReportPdfBuffer(url, result);
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

  const data = await getScanWithResult(scanId, db);
  if (!data) {
    return NextResponse.json({ error: 'Report not ready. Scan may still be processing.' }, { status: 404 });
  }

  if (format === 'html') {
    return generateFromResult(data.result, scanId, 'html', sessionId);
  }

  const subscriberAuthorized = await isSubscriberAuthorized(request, db, scanId);
  const paidSessionAuthorized = await isPaidSessionValid(request, sessionId, scanId, db);
  if (!subscriberAuthorized && !paidSessionAuthorized) {
    return NextResponse.json({ error: 'PDF not purchased. Please upgrade to access the full report.' }, { status: 403 });
  }

  return generateFromResult(data.result, scanId, 'pdf', sessionId);
}