import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { type Viewport } from 'next';
import DashboardClient from './DashboardClient';

export const viewport: Viewport = {
  themeColor: '#0f0f1a',
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get('session_token')?.value || cookieStore.get('session')?.value || '';
  const { token: urlToken } = await searchParams;
  const sessionToken = urlToken || cookieToken;

  return (
    <Suspense fallback={<div className="min-h-screen bg-midnight flex items-center justify-center"><div className="text-white/50">Loading...</div></div>}>
      <DashboardClient sessionToken={sessionToken} />
    </Suspense>
  );
}
