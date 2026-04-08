"use client";

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';

export default function ReportPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const scanId = Array.isArray(params.id) ? params.id[0] : params.id;
  const sessionId = searchParams.get('session_id') || '';

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [reportHtml, setReportHtml] = useState<string | null>(null);
  const [fullReport, setFullReport] = useState<boolean>(false);

  const handlePrint = () => {
    if (!reportHtml) return;
    const printWindow = window.open('', '_blank', 'noopener,noreferrer');
    if (!printWindow) return;
    printWindow.document.open();
    printWindow.document.write(reportHtml);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const handleDownloadPdf = async () => {
    if (!scanId) return;
    const r = await fetch(`/api/report/${encodeURIComponent(scanId)}/pdf`);
    if (!r.ok) return;
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };

  useEffect(() => {
    if (!scanId) return;

    const poll = async () => {
      const suffix = sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : '';
      const r = await fetch(`/api/report/${encodeURIComponent(scanId)}${suffix}`);
      if (!r.ok) throw new Error('Report unavailable');
      const data = await r.json() as { reportHtml?: string; fullReport?: boolean };
      if (!data.reportHtml) throw new Error('Missing report html');
      setReportHtml(data.reportHtml);
      setFullReport(Boolean(data.fullReport));
      setStatus('ready');
    };

    let cancelled = false;
    (async () => {
      let attempts = 0;
      while (!cancelled && attempts < 90) {
        try {
          await poll();
          return;
        } catch {
          attempts += 1;
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
      if (!cancelled) setStatus('error');
    })();

    return () => {
      cancelled = true;
    };
  }, [scanId, sessionId]);

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-midnight flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Report Unavailable</h1>
          <p className="text-white/60 mb-8">The scan could not be completed. Please try again.</p>
          <a href="/" className="inline-block px-6 py-3 bg-accent-blue text-white rounded-lg font-medium hover:bg-accent-blue/90 transition-all">Scan Another Site</a>
        </div>
      </div>
    );
  }

  if (status !== 'ready' || !reportHtml) {
    return (
      <div className="min-h-screen bg-midnight flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="relative w-20 h-20 mx-auto mb-8">
            <div className="absolute inset-0 rounded-full border-4 border-white/10" />
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-accent-blue animate-spin" style={{ animationDuration: '1.2s' }} />
            <div className="absolute inset-0 rounded-full flex items-center justify-center">
              <div className="w-3 h-3 bg-accent-blue rounded-full opacity-60" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">Preparing Your GDPR Report</h1>
          <p className="text-white/50 mb-1">Analysing your website for compliance issues…</p>
          <p className="text-white/30 text-sm">This takes up to 90 seconds. Please don&apos;t close this page.</p>
          {scanId && <p className="text-white/20 text-xs mt-4">Scan ID: {scanId.substring(0, 8)}…</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-midnight">
      <div className="sticky top-0 z-10 bg-midnight/95 backdrop-blur-sm border-b border-white/5">
        <div className="max-w-4xl mx-auto px-4 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-white font-semibold text-base">Your GDPR report is ready</h1>
            <p className="text-white/40 text-xs">{fullReport ? "Download a PDF or print from your browser." : "Preview report. Unlock to download the full PDF."}</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleDownloadPdf} className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 text-white rounded-lg text-sm font-medium hover:bg-white/20 transition-all">
              Download PDF
            </button>
            <button onClick={handlePrint} className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 text-white rounded-lg text-sm font-medium hover:bg-white/20 transition-all">
              Print / Save as PDF
            </button>
            <a href="/" className="inline-flex items-center gap-2 px-4 py-2 bg-accent-blue text-white rounded-lg text-sm font-medium hover:bg-accent-blue/90 transition-all">Scan Another</a>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {!fullReport && (
          <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-200 text-sm">
            This is a preview. Go back to <a className="underline" href={`/scan-results/${encodeURIComponent(scanId || '')}`}>scan results</a> to unlock with credits.
          </div>
        )}
        <div className="bg-white rounded-xl overflow-hidden shadow-2xl">
          <iframe srcDoc={reportHtml} className="w-full" style={{ height: '80vh', border: 'none' }} title="GDPR Report" />
        </div>
      </div>
    </div>
  );
}

