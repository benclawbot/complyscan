import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/env';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { hasValidCsrf, csrfErrorResponse, setCsrfCookie } from '@/lib/csrf';

interface AuthBody { email?: string; password?: string; }

export async function POST(request: NextRequest) {
  if (!hasValidCsrf(request as any)) {
    return csrfErrorResponse();
  }

  try {
    const { email, password } = await request.json() as AuthBody;
    const normalizedEmail = String(email || '').trim().toLowerCase();

    if (!normalizedEmail || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const env: any = (request as any).env ?? (globalThis as any).__env ?? undefined;
    const db = getDb(env);

    const existing = await db.prepare('SELECT id FROM users WHERE lower(email) = ?').get(normalizedEmail);
    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 });
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    const passwordHash = `${salt}:${hash}`;

    const userId = uuidv4();
    await db.prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)').run(userId, normalizedEmail, passwordHash);

    const token = uuidv4();
    await db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, userId);

    const response = NextResponse.json({ ok: true });
    response.cookies.set('session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    });
    setCsrfCookie(response);

    return response;
  } catch (err: any) {
    console.error('Signup error:', err);
    return NextResponse.json({ error: 'Signup failed' }, { status: 500 });
  }
}
