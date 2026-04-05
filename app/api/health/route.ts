import { NextRequest, NextResponse } from 'next/server';
import { getDb, getRuntimeEnv } from '@/lib/env';

export async function GET(request: NextRequest) {
  const env: any = getRuntimeEnv((request as any).env ?? (globalThis as any).__env ?? undefined);

  let dbOk = false;
  let dbError: string | null = null;
  try {
    const db = getDb(env);
    await db.prepare('SELECT 1 as ok').get();
    dbOk = true;
  } catch (error: any) {
    dbError = error?.message || String(error);
  }

  return NextResponse.json({
    ok: dbOk,
    app: 'complyscan-pages',
    timestamp: new Date().toISOString(),
    bindings: {
      DB: Boolean(env?.DB),
      SCAN_QUEUE: Boolean(env?.SCAN_QUEUE),
      REPORTS_BUCKET: Boolean(env?.REPORTS_BUCKET),
      AI: Boolean(env?.AI),
    },
    checks: {
      db: dbOk ? 'ok' : 'error',
    },
    errors: {
      db: dbError,
    },
    workerHealthUrl: 'https://compliance-checker-scan-processor.benclawbot.workers.dev/health',
  });
}
