import crypto from 'crypto';
import { NextResponse } from 'next/server';

export const CSRF_COOKIE_NAME = 'csrf_token';
export const CSRF_HEADER_NAME = 'x-csrf-token';

type CookieRequest = Request & { cookies?: { get(name: string): { value: string } | undefined } };

export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function setCsrfCookie(response: NextResponse, token: string = generateCsrfToken()) {
  response.cookies.set(CSRF_COOKIE_NAME, token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  });
  return token;
}

export function getCsrfCookie(request: CookieRequest): string | null {
  return request.cookies?.get(CSRF_COOKIE_NAME)?.value || null;
}

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export function hasValidCsrf(request: CookieRequest): boolean {
  const cookieToken = getCsrfCookie(request);
  const headerToken = request.headers.get(CSRF_HEADER_NAME) || request.headers.get(CSRF_HEADER_NAME.toUpperCase());
  if (!cookieToken || !headerToken) return false;
  try {
    return safeEqual(cookieToken, headerToken);
  } catch {
    return false;
  }
}

export function csrfErrorResponse() {
  return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
}
