import { NextRequest, NextResponse } from 'next/server';
import { generateCsrfToken, getCsrfCookie, setCsrfCookie } from '@/lib/csrf';

export async function GET(request: NextRequest) {
  const existing = getCsrfCookie(request as any);
  const csrfToken = existing || generateCsrfToken();
  const response = NextResponse.json({ ok: true, csrfToken });
  if (!existing) {
    setCsrfCookie(response, csrfToken);
  }
  return response;
}
