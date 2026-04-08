import { chromium } from 'playwright';
import { generateReportHtml, type ScanResult } from './report';

type PDFInput = {
  url: string;
  result: ScanResult;
  fullReport?: boolean;
};

export async function generatePDF(input: PDFInput): Promise<Buffer> {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const html = generateReportHtml(input.url, input.result, input.fullReport ?? true);
    await page.setContent(html, { waitUntil: 'networkidle' });
    return await page.pdf({ format: 'A4', printBackground: true });
  } finally {
    await browser.close();
  }
}
