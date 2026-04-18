import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/env';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { hasValidCsrf, csrfErrorResponse, setCsrfCookie } from '@/lib/csrf';

interface ClaimScanBody {
  email?: string;
  password?: string;
  scanId?: string;
}

export async function POST(request: NextRequest) {
  if (!hasValidCsrf(request as any)) {
    return csrfErrorResponse();
  }

  try {
    const { email, password, scanId } = await request.json() as ClaimScanBody;
    const normalizedEmail = String(email || '').trim().toLowerCase();

    if (!normalizedEmail || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const env: any = (request as any).env ?? (globalThis as any).__env ?? undefined;
    const db = getDb(env);

    let user = await db.prepare('SELECT * FROM users WHERE lower(email) = ?').get(normalizedEmail) as any;
    let isNewUser = false;

    if (!user) {
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = crypto.scryptSync(password, salt, 64).toString('hex');
      const passwordHash = `${salt}:${hash}`;
      const userId = uuidv4();
      await db.prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)').run(userId, normalizedEmail, passwordHash);
      user = { id: userId, email: normalizedEmail };
      isNewUser = true;
    } else {
      const [salt, storedHash] = String(user.password_hash || '').split(':');
      const inputHash = crypto.scryptSync(password, salt, 64).toString('hex');
      if (!salt || !storedHash || inputHash !== storedHash) {
        return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
      }
    }

    const token = uuidv4();
    await db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, user.id);

    if (scanId) {
      await db.prepare('UPDATE scans SET user_id = ? WHERE id = ? AND (user_id IS NULL OR user_id = ?)').run(user.id, scanId, user.id);
    }

    const response = NextResponse.json({ ok: true, isNewUser });
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
    console.error('Claim scan error:', err.message);
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
  }
}
