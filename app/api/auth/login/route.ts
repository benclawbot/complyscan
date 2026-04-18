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

    const env: any = (request as any).env ?? (globalThis as any).__env ?? undefined;
    const db = getDb(env);

    const user = await db.prepare('SELECT * FROM users WHERE lower(email) = ?').get(normalizedEmail) as any;
    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const [salt, storedHash] = String(user.password_hash || '').split(':');
    if (!salt || !storedHash) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    if (hash !== storedHash) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const token = uuidv4();
    await db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, user.id);

    await db.prepare('UPDATE scans SET user_id = ? WHERE lower(email) = ? AND (user_id IS NULL OR user_id = ?)').run(user.id, normalizedEmail, user.id);

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
    console.error('Login error:', err.message);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
