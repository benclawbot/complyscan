import { getBrowserRenderingSecrets } from './env';
import { generateReportHtml, type Branding } from './report';
import type { ScanResult } from './report';
import type { NormalizedScanResultV2 } from './scan-normalize';

type PDFInput = {
  url: string;
  result: ScanResult | NormalizedScanResultV2;
  fullReport?: boolean;
  branding?: Branding;
  env?: any;
};

export async function generatePDF(input: PDFInput): Promise<Buffer> {
  const html = generateReportHtml(input.url, input.result as any, input.fullReport ?? true, input.branding);

  // Production serverless path for Cloudflare: Browser Rendering REST API.
  const br = getBrowserRenderingSecrets(input.env);
  if (br) {
    const endpoint = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(br.CF_BROWSER_RENDERING_ACCOUNT_ID)}/browser-rendering/pdf`;
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${br.CF_BROWSER_RENDERING_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        html,
        pdfOptions: { format: 'A4', printBackground: true },
      }),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`Browser Rendering PDF failed: ${resp.status} ${resp.statusText} ${text}`);
    }

    const buf = await resp.arrayBuffer();
    return Buffer.from(buf);
  }

  throw new Error('PDF generation is unavailable: Cloudflare Browser Rendering is not configured.');
}
