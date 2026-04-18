"use client";

const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const encodedName = `${encodeURIComponent(name)}=`;
  const parts = document.cookie.split(';');
  for (const raw of parts) {
    const part = raw.trim();
    if (part.startsWith(encodedName)) {
      return decodeURIComponent(part.slice(encodedName.length));
    }
  }
  return null;
}

async function ensureCsrfToken(): Promise<string | null> {
  const existing = readCookie(CSRF_COOKIE_NAME);
  if (existing) return existing;

  try {
    await fetch('/api/auth/csrf', { method: 'GET', cache: 'no-store' });
  } catch {
    return null;
  }

  return readCookie(CSRF_COOKIE_NAME);
}

export async function csrfFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const method = String(init?.method || 'GET').toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return fetch(input, init);
  }

  const csrfToken = await ensureCsrfToken();
  const headers = new Headers(init?.headers || {});
  if (csrfToken) {
    headers.set(CSRF_HEADER_NAME, csrfToken);
  }

  return fetch(input, { ...init, headers });
}
