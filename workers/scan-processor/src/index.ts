/**
 * Cloudflare Queue Worker — scan processor
 *
 * Consumes jobs from the `compliance-checker-scan-queue` queue, runs the
 * crawl+analysis pipeline, and writes results back to D1.
 *
 * Deploy:
 *   cd workers/scan-processor
 *   npx wrangler deploy --name compliance-checker-scan-processor
 *
 * Required wrangler.toml bindings (workers/scan-processor/wrangler.toml):
 *   - D1 database (DB)
 *   - Queue consumer (SCAN_QUEUE)
 *   - Workers AI (AI) for LLM analysis
 */

interface ScanJob {
  scanId: string;
  url: string;
  email?: string;
  trigger: 'stripe' | 'free' | 'subscriber';
}

interface Env {
  DB: D1Database;
  SCAN_QUEUE: Queue<ScanJob>;
  AI: Ai;
  MAILJET_API_KEY: string;
  MAILJET_SECRET_KEY: string;
}

// ── Entry point ──────────────────────────────────────────────────────────────

export default {
  async queue(batch: MessageBatch<ScanJob>, env: Env): Promise<void> {
    // Process all messages — fail individually without blocking the batch
    await Promise.allSettled(
      batch.messages.map(async (msg) => {
        try {
          await processScanJob(msg.body, env);
          msg.ack();
        } catch (err) {
          console.error(`[Worker] Scan ${msg.body.scanId} failed:`, err);
          // Don't requeue — dead letter after max deliveries
          msg.retry({ backoff: { delays: [30000, 60000, 120000] } });
        }
      })
    );
  },

  // HTTP endpoint to enqueue scan jobs (queue producer for the scan-processor worker)
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // POST /enqueue { scanId, url, email, trigger }
    if (request.method === 'POST' && url.pathname === '/enqueue') {
      try {
        const body = await request.json() as ScanJob;
        if (!body.scanId || !body.url) {
          return Response.json({ error: 'scanId and url are required' }, { status: 400 });
        }
        await env.SCAN_QUEUE.send(body);
        return Response.json({ ok: true, scanId: body.scanId });
      } catch (err: any) {
        return Response.json({ error: err.message }, { status: 500 });
      }
    }

    // GET /health
    if (request.method === 'GET' && url.pathname === '/health') {
      return Response.json({ status: 'ok', queue: 'compliance-checker-scan-queue' });
    }

    return Response.json({ error: 'Not Found' }, { status: 404 });
  },
} satisfies ExportedHandler<Env>;

// ── Scan pipeline ─────────────────────────────────────────────────────────────

async function processScanJob(job: ScanJob, env: Env): Promise<void> {
  const { scanId, url, email } = job;
  console.log(`[Worker] Processing scan ${scanId} → ${url}`);

  // Mark as processing immediately
  await env.DB.prepare(`UPDATE scans SET status = 'processing' WHERE id = ?`).bind(scanId).run();

  try {
    // 1. Crawl
    const { crawlPage } = await import('../../../../lib/crawler');
    const crawlResult = await crawlPage(url);

    // 2. Rule-based GDPR checks
    const { runRuleBasedChecks } = await import('../../../../lib/gdpr-checks');
    const ruleChecks = runRuleBasedChecks(crawlResult);

    // 3. AI analysis via Workers AI (MiniMax model)
    const aiResult = await analyzeWithWorkersAI(crawlResult, ruleChecks, env.AI);

    // 4. Build result object
    const result = {
      crawl: {
        title: crawlResult.title,
        description: crawlResult.description,
        h1s: crawlResult.h1s,
        trackingScripts: crawlResult.trackingScripts,
        formsCount: crawlResult.formsCount,
        hasSSL: crawlResult.hasSSL,
        statusCode: crawlResult.statusCode,
        hasPrivacyPolicy: crawlResult.hasPrivacyPolicy,
        hasCookiePolicyPage: crawlResult.hasCookiePolicyPage,
        hasCookieBanner: crawlResult.hasCookieBanner,
        cookieBannerText: crawlResult.cookieBannerText,
        privacyPolicyUrl: crawlResult.privacyPolicyUrl,
        formInputsLabeled: crawlResult.formInputsLabeled,
        totalFormInputs: crawlResult.totalFormInputs,
        thirdPartyEmbeds: crawlResult.thirdPartyEmbeds,
      },
      ruleChecks,
      aiAnalysis: aiResult,
      scannedAt: new Date().toISOString(),
    };

    // 5. Compress and store in D1
    const rawJson = JSON.stringify(result);
    const resultJson = await compressGzipBase64(rawJson);

    await env.DB.prepare(`
      UPDATE scans
      SET status = 'completed', result_json = ?, completed_at = datetime('now')
      WHERE id = ?
    `).bind(resultJson, scanId).run();

    console.log(`[Worker] Scan ${scanId} completed — score: ${aiResult.gdprScore}`);

    // 6. Send email for subscriber scans (non-blocking)
    if (job.trigger === 'subscriber' && email && env.MAILJET_API_KEY && env.MAILJET_SECRET_KEY) {
      env.waitUntil(sendReportEmail(email, url, result));
    }
  } catch (err: any) {
    console.error(`[Worker] Scan ${scanId} error:`, err?.message || err);
    await env.DB.prepare(`UPDATE scans SET status = 'failed' WHERE id = ?`).bind(scanId).run();
    throw err; // triggers retry via backoff
  }
}

// ── Workers AI analysis ───────────────────────────────────────────────────────

interface AiAnalysisResult {
  summary: string;
  riskLevel: 'low' | 'medium' | 'high';
  issues: Array<{
    title: string;
    description: string;
    severity: 'critical' | 'warning' | 'info';
    fix: string;
  }>;
  positives: string[];
  gdprScore: number;
}

async function analyzeWithWorkersAI(
  crawlResult: any,
  ruleBasedChecks: any[],
  ai: Ai
): Promise<AiAnalysisResult> {
  // Truncate large fields
  const truncated = {
    ...crawlResult,
    html: crawlResult.html ? crawlResult.html.substring(0, 1500) + '...[truncated]' : '',
    screenshots: [],
  };

  const prompt = `You are a GDPR compliance expert. Analyze this website scan data and provide a structured GDPR compliance assessment.

SCAN DATA:
${JSON.stringify(truncated, null, 2)}

RULE-BASED CHECKS ALREADY PERFORMED:
${JSON.stringify(ruleBasedChecks, null, 2)}

Return a JSON object with this exact structure:
{
  "summary": "2-3 sentence executive summary of compliance posture",
  "riskLevel": "low | medium | high",
  "issues": [
    {
      "title": "Issue title",
      "description": "What the problem is and why it matters under GDPR",
      "severity": "critical | warning | info",
      "fix": "Specific action to fix this issue"
    }
  ],
  "positives": ["List of things done well from a GDPR perspective"],
  "gdprScore": 0-100
}

Be specific. Generic advice is not helpful. Focus on actionable fixes.`;

  // Workers AI binding — model is configured via the [ai] binding in wrangler.toml
  // The model used must be set to "MiniMax-M2.5" in the Cloudflare dashboard or via
  // the Workers AI model selection for the account.
  // If no AI binding is available, fall back to a basic result.
  if (!ai) {
    return {
      summary: 'AI analysis unavailable (no Workers AI binding).',
      riskLevel: 'medium',
      issues: [],
      positives: [],
      gdprScore: 50,
    };
  }

  const response = await ai.run('@cf/minimax/m2.5', {
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    max_tokens: 1200,
  });

  let content = response.choices?.[0]?.messages?.[0]?.content || '{}';

  // Defensive: strip any markdown fences or thinking tags
  content = content.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '').trim();
  content = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  content = content.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').trim();

  // Extract JSON object if wrapped in extra text
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) content = jsonMatch[0];

  // Fix trailing commas and control chars
  content = content.replace(/,(\s*[}\]])/g, '$1');
  content = content.replace(/[\x00-\x1F\x7F]/g, '');

  try {
    const parsed = JSON.parse(content) as AiAnalysisResult;
    if (parsed.gdprScore === undefined || !parsed.issues) {
      throw new Error('Invalid AI response shape');
    }
    return parsed;
  } catch {
    console.error('[Worker] AI parse failed, using fallback:', content.substring(0, 200));
    return {
      summary: 'AI analysis unavailable. Please try again.',
      riskLevel: 'medium',
      issues: [],
      positives: [],
      gdprScore: 50,
    };
  }
}

// ── Compression (Web API — works in Workers) ──────────────────────────────────

async function compressGzipBase64(text: string): Promise<string> {
  const encoded = new TextEncoder().encode(text);
  const cs = new CompressionStream('gzip');
  const writer = cs.writable.getWriter();
  writer.write(encoded);
  writer.close();
  const reader = cs.readable.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const total = chunks.reduce((s, c) => s + c.byteLength, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) { merged.set(c, offset); offset += c.byteLength; }

  // Convert to base64
  let binary = '';
  for (let i = 0; i < merged.length; i++) binary += String.fromCharCode(merged[i]);
  return btoa(binary);
}

// ── Email (Mailjet) ───────────────────────────────────────────────────────────

async function sendReportEmail(email: string, url: string, result: any): Promise<void> {
  try {
    const apiKey = env.MAILJET_API_KEY;
    const secretKey = env.MAILJET_SECRET_KEY;
    if (!apiKey || !secretKey) {
      console.error('[Worker] Mailjet credentials not configured');
      return;
    }
    const html = generateReportHtml(url, result);
    const credentials = btoa(`${apiKey}:${secretKey}`);
    const response = await fetch('https://api.mailjet.com/v3.1/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${credentials}`,
      },
      body: JSON.stringify({
        Messages: [{
          From: { Email: 'reports@complyscan.com', Name: 'ComplyScan' },
          To: [{ Email: email }],
          Subject: `GDPR Compliance Report for ${url}`,
          HTMLPart: html,
        }],
      }),
    });
    if (!response.ok) {
      const errText = await response.text();
      console.error('[Worker] Mailjet API error:', response.status, errText);
    }
  } catch (err) {
    console.error('[Worker] Failed to send report email:', err);
  }
}

function generateReportHtml(url: string, result: any): string {
  const { ruleChecks, aiAnalysis } = result;
  const score = aiAnalysis?.gdprScore ?? 0;
  const scoreColor = score >= 70 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#ef4444';

  const checksHtml = ruleChecks.map((check: any) => `
    <div style="padding:12px;margin:8px 0;border-radius:8px;background:#f5f5f5;border-left:4px solid ${check.passed ? '#22c55e' : '#ef4444'};">
      <strong>${check.name}</strong> — ${check.passed ? 'PASS' : 'FAIL'}
      <p>${check.detail}</p>
      ${check.recommendation ? `<p><em>Fix: ${check.recommendation}</em></p>` : ''}
    </div>
  `).join('');

  const issuesHtml = aiAnalysis?.issues?.length
    ? aiAnalysis.issues.map((issue: any) => `
        <div style="padding:12px;margin:8px 0;border-radius:8px;background:#fef2f2;border-left:4px solid #ef4444;">
          <strong>${issue.title}</strong> (${issue.severity})
          <p>${issue.description}</p>
          <p><strong>Fix:</strong> ${issue.fix}</p>
        </div>
      `).join('')
    : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>GDPR Report</title>
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:800px;margin:0 auto;padding:40px 20px;color:#1a1a2e;">
  <div style="text-align:center;margin-bottom:40px;">
    <h1 style="font-size:28px;color:#4f8ef7;">ComplyScan</h1>
    <h2>GDPR Compliance Report</h2>
    <p style="color:#666;">${url}</p>
  </div>
  <div style="text-align:center;font-size:72px;font-weight:bold;color:${scoreColor};">${score}/100</div>
  <div style="text-align:center;color:#666;margin-bottom:30px;">GDPR Compliance Score</div>
  <div style="margin-bottom:30px;">
    <h3 style="border-bottom:2px solid #4f8ef7;padding-bottom:8px;">Automated Checks</h3>
    ${checksHtml}
  </div>
  ${issuesHtml ? `<div style="margin-bottom:30px;">
    <h3 style="border-bottom:2px solid #4f8ef7;padding-bottom:8px;">AI-Detected Issues</h3>
    ${issuesHtml}
  </div>` : ''}
  <div style="text-align:center;color:#999;font-size:12px;margin-top:50px;">
    <p>Generated by ComplyScan — GDPR compliance made effortless</p>
  </div>
</body>
</html>`;
}
