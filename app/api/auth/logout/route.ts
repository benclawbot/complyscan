import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/env';
import { getSessionToken, revokeSession } from '@/lib/auth';
import { hasValidCsrf, csrfErrorResponse } from '@/lib/csrf';

export async function POST(request: NextRequest) {
  if (!hasValidCsrf(request as any)) {
    return csrfErrorResponse();
  }

  const token = getSessionToken(request as any);

  const response = NextResponse.json({ ok: true });
  response.cookies.set('session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });

  if (!token) return response;

  const env: any = (request as any).env ?? (globalThis as any).__env ?? undefined;
  const db = getDb(env);
  await revokeSession(db, token);
  return response;
}
