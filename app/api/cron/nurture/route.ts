import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    ok: true,
    disabled: true,
    message: 'Nurture email cron is disabled. ComplyScan no longer sends user emails for auth/recovery/marketing.',
  });
}
