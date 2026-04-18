import { NextRequest, NextResponse } from 'next/server';
import { getDb, getRuntimeEnv, parseResultJson, getStripeSecrets } from '@/lib/env';
import { generateReportHtml } from '@/lib/report';
import { retrieveCheckoutSession } from '@/lib/stripe-api';
import { requireUserSession, getActiveSubscriberForUser } from '@/lib/auth';
import { getBranding } from '@/lib/branding';
import { hasUnlockedReport, unlockReportWithCredit } from '@/lib/report-access';

function jsonNoStore(data: any, init?: ResponseInit) {
  return NextResponse.json(data, {
    ...init,
    headers: {
      'Cache-Control': 'no-store',
      ...(init?.headers || {}),
    },
  });
}

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
    const auth = await requireUserSession(request as any, db);
    let branding: any = null;
    let full = false;

    if (auth) {
      const subscriber = await getActiveSubscriberForUser(db, auth.session.user_id);
      const authorizedByUser = Boolean(scan.user_id) && scan.user_id === auth.session.user_id;
      const authorizedBySubscriber = Boolean(subscriber?.id) && Boolean(scan.subscriber_id) && scan.subscriber_id === subscriber.id;
      const authorizedByEmail = Boolean(scan.email) && scan.email === auth.session.email;

      if (!authorizedByUser && !authorizedBySubscriber && !authorizedByEmail) {
        return jsonNoStore({ error: 'Forbidden' }, { status: 403 });
      }

      if (authorizedBySubscriber && subscriber) {
        branding = await getBranding(db, { type: 'subscriber', id: subscriber.id });
        full = true;
      } else {
        branding = await getBranding(db, { type: 'user', id: auth.session.user_id });
        const unlocked = await hasUnlockedReport(db, scanId);
        if (unlocked) {
          full = true;
        } else {
          const credits = Number(auth.session.credits ?? 0);
          if (credits > 0) {
            full = await unlockReportWithCredit(db, auth.session.user_id, scanId);
          }
        }
      }
    }

    return jsonNoStore({
      reportHtml: generateReportHtml(scan.url || '', result as any, full, branding ?? undefined),
      url: scan.url || '',
      fullReport: full,
    });
  }

  if (!scan) {
    return jsonNoStore({ error: 'Scan not found' }, { status: 404 });
  }

  if (scan.status === 'pending' || scan.status === 'processing') {
    return jsonNoStore({ error: 'Scan not yet complete' }, { status: 202 });
  }

  if (scan.status === 'failed') {
    return jsonNoStore({ error: 'Scan failed. Please try again.' }, { status: 500 });
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
            return jsonNoStore({
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

  return jsonNoStore({ error: 'Scan not yet complete' }, { status: 202 });
}
