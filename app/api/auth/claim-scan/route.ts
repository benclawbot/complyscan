import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/env';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

interface ClaimScanBody {
  email?: string;
  password?: string;
  scanId?: string;
}

// POST /api/auth/claim-scan
// Creates a user account (or logs in existing) and links the scan to it.
// Used on the free-scan results page to let users "save" their scan.
export async function POST(request: NextRequest) {
  try {
    const { email, password, scanId } = await request.json() as ClaimScanBody;

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const env: any = (request as any).env ?? (globalThis as any).__env ?? undefined;
    const db = getDb(env);

    // Look up existing user by email
    let user = await db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
    let isNewUser = false;

    if (!user) {
      // Create new user
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = crypto.scryptSync(password, salt, 64).toString('hex');
      const passwordHash = `${salt}:${hash}`;
      const userId = uuidv4();
      await db.prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)').run(userId, email, passwordHash);
      user = { id: userId, email };
      isNewUser = true;
    } else {
      // Verify password
      const [salt, storedHash] = user.password_hash.split(':');
      const inputHash = crypto.scryptSync(password, salt, 64).toString('hex');
      if (inputHash !== storedHash) {
        return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
      }
    }

    // Create session
    const token = uuidv4();
    await db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, user.id);

    // Link scan to user if scanId provided
    if (scanId) {
      await db.prepare('UPDATE scans SET user_id = ? WHERE id = ? AND (user_id IS NULL OR user_id = ?)').run(user.id, scanId, user.id);
    }

    const response = NextResponse.json({
      ok: true,
      token,
      isNewUser,
    });
    response.cookies.set('session_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    });

    // Marketing nurture is only sent with explicit opt-in.
    // This endpoint does not collect marketing consent, so we skip auto-subscription.

    return response;
  } catch (err: any) {
    console.error('Claim scan error:', err.message);
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
  }
}
