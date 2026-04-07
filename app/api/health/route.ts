import { NextRequest, NextResponse } from 'next/server';
import { getDb, getRuntimeEnv, getStripeSecrets } from '@/lib/env';

export async function GET(request: NextRequest) {
  const env: any = getRuntimeEnv((request as any).env ?? (globalThis as any).__env ?? undefined);
  const stripeSecrets = getStripeSecrets(request as any);
  const cloudflareContextEnv = (globalThis as any)[Symbol.for('__cloudflare-context__')]?.env;

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
      stripe: stripeSecrets ? 'ok' : 'missing',
    },
    env_debug: {
      requestEnvPresent: Boolean((request as any).env),
      globalEnvPresent: Boolean((globalThis as any).__env),
      cloudflareContextPresent: Boolean(cloudflareContextEnv),
      processStripeSecret: Boolean(process.env.STRIPE_SECRET_KEY),
      processStripeMonthlyPrice: Boolean(process.env.STRIPE_PRICE_MONTHLY),
      resolvedStripeSecret: Boolean(stripeSecrets?.STRIPE_SECRET_KEY),
      resolvedStripeMonthlyPrice: Boolean(stripeSecrets?.STRIPE_PRICE_MONTHLY),
    },
    errors: {
      db: dbError,
    },
    workerHealthUrl: 'https://compliance-checker-scan-processor.benclawbot.workers.dev/health',
  });
}



