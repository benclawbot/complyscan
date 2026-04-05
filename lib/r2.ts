/**
 * R2 client for storing and retrieving PDF reports
 */

export interface Env {
  REPORTS_BUCKET: R2Bucket;
  NEXT_PUBLIC_APP_URL: string;
}

/**
 * Store a PDF report in R2.
 * @param scanId - The scan ID used as the R2 key
 * @param pdfData - Raw PDF bytes
 */
export async function storeReport(scanId: string, pdfData: ArrayBuffer, env: Env): Promise<string> {
  const key = `reports/${scanId}.pdf`;
  await env.REPORTS_BUCKET.put(key, pdfData, {
    httpMetadata: {
      contentType: 'application/pdf',
    },
    customMetadata: {
      scanId,
      storedAt: new Date().toISOString(),
    },
  });
  return key;
}

/**
 * Retrieve a PDF report from R2.
 */
export async function getReport(scanId: string, env: Env): Promise<R2Object | null> {
  const key = `reports/${scanId}.pdf`;
  const object = await env.REPORTS_BUCKET.get(key);
  return object;
}

/**
 * Check if a report exists in R2.
 */
export async function reportExists(scanId: string, env: Env): Promise<boolean> {
  const key = `reports/${scanId}.pdf`;
  const object = await env.REPORTS_BUCKET.head(key);
  return object !== null;
}

/**
 * Delete a report from R2.
 */
export async function deleteReport(scanId: string, env: Env): Promise<void> {
  const key = `reports/${scanId}.pdf`;
  await env.REPORTS_BUCKET.delete(key);
}

/**
 * Generate a public URL for a report (signed URL, 1 hour expiry).
 */
export async function getSignedReportUrl(scanId: string, env: Env): Promise<string> {
  const key = `reports/${scanId}.pdf`;
  // createSignedUrl exists on R2Bucket at runtime but @cloudflare/workers-types is out of date
   
  const url = await (env.REPORTS_BUCKET as any).createSignedUrl({
    pathname: key,
    expires: 3600,
  });
  return url;
}