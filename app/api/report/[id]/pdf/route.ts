import { NextRequest, NextResponse } from 'next/server';
import { getDb, getRuntimeEnv, parseResultJson } from '@/lib/env';
import { generatePDF } from '@/lib/report-pdf';
import { buildMockScanResult } from '@/lib/mock-scan';

async function getScanResult(db: ReturnType<typeof getDb>, scanId: string) {
  const scan = await db.prepare('SELECT * FROM scans WHERE id = ?').get(scanId) as any;
  if (!scan) return { scan: null, result: null };
  const result = scan.result_json ? await parseResultJson(scan.result_json) : null;
  return { scan, result };
}

function pdfResponse(pdf: Buffer, fileBase: string) {
  return new NextResponse(pdf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${fileBase}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: scanId } = await params;

  if (scanId === 'test') {
    const url = request.nextUrl.searchParams.get('url') || 'https://example.com';
    const mockResult = buildMockScanResult(url, true);
    const pdf = await generatePDF({ url, result: mockResult, fullReport: true });
    return pdfResponse(pdf, 'gdpr-report-test');
  }

  const env: any = getRuntimeEnv((request as any).env ?? (globalThis as any).__env ?? undefined);
  const db = getDb(env);
  const { scan, result } = await getScanResult(db, scanId);

  if (!scan) {
    return NextResponse.json({ error: 'Scan not found' }, { status: 404 });
  }

  if (scan.status === 'pending' || scan.status === 'processing' || !result) {
    return NextResponse.json({ error: 'Scan not yet complete' }, { status: 202 });
  }

  if (scan.status === 'failed') {
    return NextResponse.json({ error: 'Scan failed. Please try again.' }, { status: 500 });
  }

  const fileBase = `gdpr-report-${scanId}`;
  const pdf = await generatePDF({
    url: scan.url || '',
    result,
    fullReport: true,
  });
  return pdfResponse(pdf, fileBase);
}
