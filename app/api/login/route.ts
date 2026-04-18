import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    {
      error: 'Email-link login was removed. Use password or passkey login.',
      code: 'EMAIL_LOGIN_REMOVED',
    },
    { status: 410 }
  );
}
