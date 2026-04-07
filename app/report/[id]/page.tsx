"use client";

import { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';

export default function ReportPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const scanId = Array.isArray(params.id) ? params.id[0] : params.id;
  const sessionId = searchParams.get('session_id') || '';
  const token = searchParams.get('token') || '';

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [reportHtml, setReportHtml] = useState<string | null>(null);

  useEffect(() => {
    if (!scanId) return;

    const loadFromStoredResult = async () => {
      try {
        const stored = sessionStorage.getItem(`scan:${scanId}`);
        if (!stored) return false;
        const result = JSON.parse(stored);
        const r = await fetch(`/api/report/${encodeURIComponent(scanId)}/pdf?format=html`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(result),
        });
        if (!r.ok) return false;
        setReportHtml(await r.text());
        setStatus('ready');
        return true;
      } catch {
        return false;
      }
    };

    const poll = async () => {
      const suffix = sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : '';
      const r = await fetch(`/api/report/${encodeURIComponent(scanId)}${suffix}`);
      if (!r.ok) throw new Error('Report unavailable');
      const data = await r.json() as { reportHtml?: string };
      if (!data.reportHtml) throw new Error('Missing report html');
      setReportHtml(data.reportHtml);
      setStatus('ready');
    };

    let cancelled = false;
    (async () => {
      const loaded = await loadFromStoredResult();
      if (loaded || cancelled) return;

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

  const handleDownloadPdf = async () => {
    if (!reportHtml) return;
    const btn = document.getElementById('download-pdf-btn') as HTMLButtonElement;
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Generating PDF…';
    }
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      // Create an off-screen container with the report HTML
      const container = document.createElement('div');
      container.innerHTML = reportHtml;
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.top = '0';
      container.style.width = '794px'; // A4 width in px at 96dpi
      container.style.background = '#ffffff';
      container.style.color = '#1e293b';
      document.body.appendChild(container);

      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        width: 794,
        height: container.scrollHeight,
      });

      document.body.removeChild(container);

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: 'a4' });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      const ratio = Math.min(pdfWidth / canvasWidth, pdfHeight / canvasHeight);
      const imgWidth = canvasWidth * ratio;
      const imgHeight = canvasHeight * ratio;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;
      while (heightLeft > 0) {
        position -= pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      const url = reportHtml.match(/https?:\/\/[^\s<"]+/)?.[0] ?? 'report';
      const safeName = url.replace(/[^a-zA-Z0-9.-]/g, '_').slice(0, 60);
      pdf.save(`GDPR-Report-${safeName}.pdf`);
    } catch (err) {
      alert('PDF generation failed. Please try again.');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Download PDF';
      }
    }
  };

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
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-success/20 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-success" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-white font-semibold text-sm">Your GDPR Report is Ready</p>
              <p className="text-white/40 text-xs">Scan complete — scroll for full results</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              id="download-pdf-btn"
              onClick={handleDownloadPdf}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 text-white rounded-lg text-sm font-medium hover:bg-white/20 transition-all border border-white/10 disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download PDF
            </button>
            <a href="/" className="inline-flex items-center gap-2 px-4 py-2 bg-accent-blue text-white rounded-lg text-sm font-medium hover:bg-accent-blue/90 transition-all">Scan Another</a>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="bg-white rounded-xl overflow-hidden shadow-2xl">
          <iframe srcDoc={reportHtml} className="w-full" style={{ height: '80vh', border: 'none' }} title="GDPR Report" />
        </div>
      </div>
    </div>
  );
}
