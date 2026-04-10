import { NextRequest, NextResponse } from 'next/server';
import { getDb, parseResultJson } from '@/lib/env';
import { getBearerToken, getSubscriberTokenRecord, getUserSession, touchSubscriberToken, touchUserSession } from '@/lib/auth';
import { hasUnlockedReport, unlockReportWithCredit } from '@/lib/report-access';
import { isNormalizedScanResultV2, normalizeScanResultV2 } from '@/lib/scan-normalize';

function jsonNoStore(data: any, init?: ResponseInit) {
  return NextResponse.json(data, {
    ...init,
    headers: {
      'Cache-Control': 'no-store',
      ...(init?.headers || {}),
    },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const env: any = (request as any).env ?? (globalThis as any).__env ?? undefined;
  const db = getDb(env);

  const scan = await db.prepare('SELECT * FROM scans WHERE id = ?').get(id) as any;
  if (!scan) {
    return jsonNoStore({ error: 'Scan not found' }, { status: 404 });
  }

  const rawResult = scan.result_json ? await parseResultJson(scan.result_json) : undefined;

  let normalized: any = null;
  if (rawResult) {
    normalized = isNormalizedScanResultV2(rawResult)
      ? rawResult
      : normalizeScanResultV2({
          url: scan.url || '',
          crawl: rawResult.crawl,
          ruleChecks: rawResult.ruleChecks || [],
          aiAnalysis: rawResult.aiAnalysis || {},
          scannedAt: rawResult.scannedAt || scan.completed_at || scan.created_at || new Date().toISOString(),
        });
  }

  const token = getBearerToken(request) || request.cookies.get('session_token')?.value || request.cookies.get('session')?.value || null;
  let fullAccess = false;

  if (token && scan.status === 'completed') {
    const sub = await getSubscriberTokenRecord(db, token);
    if (sub) {
      await touchSubscriberToken(db, token);
      const authorized = !scan.subscriber_id || scan.subscriber_id === sub.subscriber_id || scan.email === sub.email;
      fullAccess = authorized;
    } else {
      const user = await getUserSession(db, token);
      if (user) {
        await touchUserSession(db, token);
        const authorized = !scan.user_id || scan.user_id === user.user_id || scan.email === user.email;
        if (authorized) {
          if (scan.subscriber_id) {
            fullAccess = true;
          } else {
            const unlocked = await hasUnlockedReport(db, id);
            if (unlocked) {
              fullAccess = true;
            } else {
              const credits = Number(user.credits ?? 0);
              if (credits > 0) {
                fullAccess = await unlockReportWithCredit(db, user.user_id, id);
              }
            }
          }
        }
      }
    }
  }

  const result = normalized
    ? (fullAccess
        ? normalized
        : {
            version: 2,
            url: normalized.url,
            scannedAt: normalized.scannedAt,
            score: normalized.score,
            risk: normalized.risk,
            summary: normalized.summary,
            positives: (normalized.positives || []).slice(0, 2),
            issues: (normalized.issues || []).slice(0, 2),
            signals: normalized.signals,
            raw: { crawl: normalized.raw.crawl, ruleChecks: (normalized.raw.ruleChecks || []).slice(0, 5), aiAnalysis: { ...normalized.raw.aiAnalysis, issues: (normalized.raw.aiAnalysis?.issues || []).slice(0, 2) } },
          })
    : undefined;

  return jsonNoStore({
    id: scan.id,
    url: scan.url,
    email: scan.email,
    status: scan.status,
    result,
    fullAccess,
    created_at: scan.created_at,
    completed_at: scan.completed_at,
  });
}


