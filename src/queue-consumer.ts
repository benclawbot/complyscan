/**
 * Cloudflare Queue Consumer for async scan processing
 * Handles scan jobs from the SCAN_QUEUE, replacing the synchronous
 * scan-in-request pattern that causes timeouts and cold-start failures.
 *
 * Deploy as a separate Worker with [queues] binding:
 *   wrangler deploy src/queue-consumer.ts --name compliance-checker-queue-worker
 */

// compression disabled for now
const compressGzip = async (data: string) => new TextEncoder().encode(data);

interface ScanJob {
  scanId: string;
  url: string;
  email?: string;
  trigger: 'stripe' | 'free' | 'subscriber';
}

interface Env {
  DB: D1Database;
  SCAN_QUEUE: Queue<ScanJob>;
  AI_API_KEY?: string;
}

export default {
  async queue(batch: MessageBatch<ScanJob>, env: Env): Promise<void> {
    for (const msg of batch.messages) {
      try {
        await processScanJob(msg.body, env);
        msg.ack();
      } catch (err) {
        console.error(`Scan ${msg.body.scanId} failed:`, err);
        // no requeue // 30s backoff
      }
    }
  },
};

async function processScanJob(job: ScanJob, env: Env): Promise<void> {
  const { scanId, url } = job;
  console.log(`Processing scan ${scanId} for ${url}`);

  // Mark as processing
  await env.DB.prepare(`UPDATE scans SET status = 'processing' WHERE id = ?`).bind(scanId).run();

  try {
    // Run the actual scan pipeline
        const { crawlPage } = await import('../lib/crawler');
        const { runRuleBasedChecks } = await import('../lib/gdpr-checks');
        const { analyzeWithAI } = await import('../lib/ai-analysis');

    const crawlResult = await crawlPage(url);
    const ruleChecks = runRuleBasedChecks(crawlResult);
    const aiResult = await analyzeWithAI(crawlResult, ruleChecks);

    const result = {
      crawl: {
        title: crawlResult.title,
        description: crawlResult.description,
        h1s: crawlResult.h1s,
        trackingScripts: crawlResult.trackingScripts,
        formsCount: crawlResult.formsCount,
        hasSSL: crawlResult.hasSSL,
        statusCode: crawlResult.statusCode,
      },
      ruleChecks,
      aiAnalysis: aiResult,
      scannedAt: new Date().toISOString(),
    };

    // Compress result before storing
    const rawJson = JSON.stringify(result);
    const resultJson = await compressGzip(rawJson);

    await env.DB.prepare(`
      UPDATE scans
      SET status = 'completed', result_json = ?, completed_at = datetime('now')
      WHERE id = ?
    `).bind(resultJson, scanId).run();

    console.log(`Scan ${scanId} completed successfully`);
  } catch (err: any) {
    console.error(`Scan ${scanId} error:`, err.message);
    await env.DB.prepare(`UPDATE scans SET status = 'failed' WHERE id = ?`).bind(scanId).run();
    throw err; // requeue
  }
}
