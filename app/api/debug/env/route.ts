import { NextRequest, NextResponse } from 'next/server';
import { getRuntimeEnv, getStripeSecrets } from '@/lib/env';

export async function GET(request: NextRequest) {
  const env: any = getRuntimeEnv((request as any).env ?? (globalThis as any).__env ?? undefined);
  const stripeSecrets = getStripeSecrets((request as any).env ?? (globalThis as any).__env ?? undefined);
  
  const hasMockStripe = env?.MOCK_STRIPE === '1' || env?.E2E_TEST_MODE === '1' || process.env?.MOCK_STRIPE === '1' || process.env?.E2E_TEST_MODE === '1';
  const hasStripeKey = Boolean(stripeSecrets?.STRIPE_SECRET_KEY);
  const hasPricePdf = Boolean(stripeSecrets?.STRIPE_PRICE_PDF_REPORT);
  const hasPriceMonthly = Boolean(stripeSecrets?.STRIPE_PRICE_MONTHLY);
  const runtimeKeys = env ? Object.keys(env).filter(k => !k.startsWith('_') && !k.startsWith('NEXT_PUBLIC') && k !== 'DB' && k !== 'SCAN_QUEUE' && k !== 'REPORTS_BUCKET' && k !== 'AI') : [];
  const processKeys = typeof process !== 'undefined' ? Object.keys(process.env || {}).filter(k => !k.startsWith('npm_') && !k.startsWith('NODE') && k !== 'HOME' && k !== 'PATH' && k !== 'PWD') : [];
  
  return NextResponse.json({
    MOCK_STRIPE: hasMockStripe,
    hasStripeKey,
    hasPricePdf,
    hasPriceMonthly,
    runtimeEnvKeys: runtimeKeys,
    processEnvKeys: processKeys.slice(0, 20),
    appUrl: env?.NEXT_PUBLIC_APP_URL || process.env?.NEXT_PUBLIC_APP_URL || 'not set',
  });
}
