import crypto from 'crypto';
import { NextRequest } from 'next/server';

export function randomBase64Url(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function decodeBase64UrlJson<T = any>(value: string): T {
  const buf = Buffer.from(value, 'base64url');
  return JSON.parse(buf.toString('utf8')) as T;
}

export function hashSha256(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

export function resolveRpId(request: NextRequest): string {
  const configured = process.env.WEBAUTHN_RP_ID?.trim();
  if (configured) return configured;
  return request.nextUrl.hostname;
}

export function normalizeEmail(value: string): string {
  return String(value || '').trim().toLowerCase();
}
