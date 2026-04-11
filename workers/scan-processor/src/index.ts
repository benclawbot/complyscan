/**
 * Cloudflare Queue Worker — scan processor
 * Self-contained worker implementation for queue-driven scans.
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
  MAILJET_API_KEY?: string;
  MAILJET_SECRET_KEY?: string;
}

interface CrawlResult {
  url: string;
  title: string;
  description: string;
  h1s: string[];
  hasPrivacyPolicy: boolean;
  privacyPolicyUrl: string | null;
  privacyPolicyHtml: string | null;
  hasCookieBanner: boolean;
  cookieBannerText: string | null;
  trackingScripts: string[];
  formsCount: number;
  formInputsLabeled: number;
  totalFormInputs: number;
  hasSSL: boolean;
  screenshots: string[];
  html: string;
  statusCode: number;
  securityHeaders: Record<string, string>;
  hasCookiePolicyPage: boolean;
  thirdPartyEmbeds: string[];
  mixedContent: boolean;
  marketingOptinStatus: 'present_not_prechecked' | 'pre_checked' | 'missing' | 'no_forms';
  processorDisclosure: boolean;
  processorsFound: string[];
  hasInternationalTransferDisclosure: boolean;
  hasDataRetentionDisclosure: boolean;
  retentionDetails: string | null;
  userRightsMechanism: boolean;
  userRightsFound: string[];
  dpoContact: string | null;
  supervisoryAuthority: string | null;
  ageRestriction: string | null;
  hasAutomatedDecisionMakingDisclosure: boolean;
  hasConsentWithdrawalMechanism: boolean;
}

interface GdprCheck {
  id: string;
  name: string;
  description: string;
  severity: 'critical' | 'warning' | 'info';
  passed: boolean;
  detail: string;
  recommendation: string;
}

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

type NormalizedIssueSeverity = 'critical' | 'warning' | 'info';

type NormalizedIssue = {
  type: string;
  severity: NormalizedIssueSeverity;
  title: string;
  impact: string;
  fix: string;
  evidence: Record<string, unknown>;
  gdprArticle?: string;
};

type NormalizedScanResultV2 = {
  version: 2;
  url: string;
  scannedAt: string;
  score: number;
  risk: 'low' | 'medium' | 'high' | 'critical';
  summary: string;
  positives: string[];
  issues: NormalizedIssue[];
  signals: {
    hasSSL: boolean;
    statusCode: number;
    hasPrivacyPolicy: boolean;
    privacyPolicyUrl: string | null;
    hasCookieBanner: boolean;
    cookieBannerText: string | null;
    trackingScripts: string[];
    thirdPartyEmbeds: string[];
    hasCookiePolicyPage: boolean;
    formsCount: number;
    totalFormInputs: number;
    formInputsLabeled: number;
    mixedContent?: boolean;
  };
  raw: {
    crawl: CrawlResult;
    ruleChecks: GdprCheck[];
    aiAnalysis: AiAnalysisResult;
  };
};

function normalizeRiskLevel(risk: unknown): NormalizedScanResultV2['risk'] {
  const r = String(risk || '').toLowerCase().trim();
  if (r === 'critical') return 'critical';
  if (r === 'high') return 'high';
  if (r === 'medium') return 'medium';
  if (r === 'low') return 'low';
  return 'medium';
}

function clampScore(score: unknown): number {
  const n = typeof score === 'number' ? score : Number(score);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function normalizeForStorage(url: string, crawl: CrawlResult, ruleChecks: GdprCheck[], aiAnalysis: AiAnalysisResult, scannedAt: string): NormalizedScanResultV2 {
  const issues: NormalizedIssue[] = [];
  for (const rc of ruleChecks || []) {
    if (rc.passed) continue;
    issues.push({
      type: String(rc.id || 'rule_check'),
      severity: rc.severity || 'warning',
      title: String(rc.name || 'Failed check'),
      impact: String(rc.detail || ''),
      fix: String(rc.recommendation || ''),
      evidence: { url: crawl.url, cookieBannerText: crawl.cookieBannerText, trackingScripts: crawl.trackingScripts },
      gdprArticle: (rc as any).gdprArticle ? String((rc as any).gdprArticle) : undefined,
    });
  }
  for (const aiIssue of aiAnalysis?.issues || []) {
    issues.push({
      type: 'ai_finding',
      severity: aiIssue.severity,
      title: String(aiIssue.title || 'AI finding'),
      impact: String((aiIssue as any).impact || aiIssue.description || ''),
      fix: String(aiIssue.fix || ''),
      evidence: {},
    });
  }

  return {
    version: 2,
    url,
    scannedAt,
    score: clampScore(aiAnalysis?.gdprScore),
    risk: normalizeRiskLevel(aiAnalysis?.riskLevel),
    summary: String(aiAnalysis?.summary || ''),
    positives: Array.isArray(aiAnalysis?.positives) ? aiAnalysis.positives.map(String) : [],
    issues,
    signals: {
      hasSSL: Boolean(crawl.hasSSL),
      statusCode: Number(crawl.statusCode || 0),
      hasPrivacyPolicy: Boolean(crawl.hasPrivacyPolicy),
      privacyPolicyUrl: crawl.privacyPolicyUrl ?? null,
      hasCookieBanner: Boolean(crawl.hasCookieBanner),
      cookieBannerText: crawl.cookieBannerText ?? null,
      trackingScripts: Array.isArray(crawl.trackingScripts) ? crawl.trackingScripts : [],
      thirdPartyEmbeds: Array.isArray(crawl.thirdPartyEmbeds) ? crawl.thirdPartyEmbeds : [],
      hasCookiePolicyPage: Boolean(crawl.hasCookiePolicyPage),
      formsCount: Number(crawl.formsCount || 0),
      totalFormInputs: Number(crawl.totalFormInputs || 0),
      formInputsLabeled: Number(crawl.formInputsLabeled || 0),
      mixedContent: (crawl as any).mixedContent,
    },
    raw: { crawl, ruleChecks, aiAnalysis },
  };
}

export default {
  async queue(batch: MessageBatch<ScanJob>, env: Env): Promise<void> {
    await Promise.allSettled(
      batch.messages.map(async (msg) => {
        try {
          await processScanJob(msg.body, env);
          msg.ack();
        } catch (err) {
          console.error(`[Worker] Scan ${msg.body.scanId} failed:`, err);
          msg.retry({ backoff: { delays: [30000, 60000, 120000] } });
        }
      })
    );
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

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

    if (request.method === 'POST' && url.pathname === '/mail/send') {
      try {
        const body = await request.json() as { email?: string; subject?: string; html?: string; name?: string };
        const email = String(body?.email || '').trim();
        const subject = String(body?.subject || '').trim();
        const html = String(body?.html || '');
        const name = body?.name ? String(body.name) : undefined;

        if (!email || !subject || !html) {
          return Response.json({ error: 'email, subject and html are required' }, { status: 400 });
        }

        await sendHtmlEmail(env, { email, subject, html, name });
        return Response.json({ ok: true });
      } catch (err: any) {
        console.error('[Worker] /mail/send error:', err?.message || err);
        return Response.json({ error: err?.message || 'mail send failed' }, { status: 500 });
      }
    }

    if (request.method === 'GET' && url.pathname === '/health') {
      return Response.json({ status: 'ok', queue: 'compliance-checker-scan-queue' });
    }

    return Response.json({ error: 'Not Found' }, { status: 404 });
  },
} satisfies ExportedHandler<Env>;

async function processScanJob(job: ScanJob, env: Env): Promise<void> {
  const { scanId, url, email } = job;
  console.log(`[Worker] Processing scan ${scanId} → ${url}`);

  await env.DB.prepare(`UPDATE scans SET status = 'processing' WHERE id = ?`).bind(scanId).run();

  try {
    const crawlResult = await crawlPageForWorker(url);
    const ruleChecks = runRuleBasedChecks(crawlResult);
    const aiResult = await analyzeWithWorkersAI(crawlResult, ruleChecks, env.AI);

    const scannedAt = new Date().toISOString();
    const result = normalizeForStorage(url, crawlResult, ruleChecks, aiResult, scannedAt);

    const resultJson = await compressGzipBase64(JSON.stringify(result));
    await env.DB.prepare(`
      UPDATE scans
      SET status = 'completed', result_json = ?, completed_at = datetime('now')
      WHERE id = ?
    `).bind(resultJson, scanId).run();

    console.log(`[Worker] Scan ${scanId} completed — score: ${aiResult.gdprScore}`);

    if (job.trigger === 'subscriber' && email && env.MAILJET_API_KEY && env.MAILJET_SECRET_KEY) {
      await sendReportEmail(env, email, url, result);
    }
  } catch (err: any) {
    console.error(`[Worker] Scan ${scanId} error:`, err?.message || err);
    await env.DB.prepare(`UPDATE scans SET status = 'failed' WHERE id = ?`).bind(scanId).run();
    throw err;
  }
}

function extractText(html: string, tag: string, maxLen = 200): string {
  const match = html.match(new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`, 'i'));
  return match ? match[1].trim().slice(0, maxLen) : '';
}

function extractAllText(html: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`, 'gi');
  const results: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) results.push(match[1].trim());
  return results;
}

function extractMetaContent(html: string, name: string): string {
  const patterns = [
    new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return match[1].trim().slice(0, 500);
  }
  return '';
}

function extractLinksWithText(html: string, patterns: string[]): Array<{ href: string; text: string }> {
  const results: Array<{ href: string; text: string }> = [];
  const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1];
    const text = match[2].toLowerCase();
    if (patterns.some((pattern) => href.toLowerCase().includes(pattern) || text.includes(pattern))) {
      results.push({ href, text });
    }
  }
  return results;
}

function countElements(html: string, selector: 'form' | 'input'): number {
  const patterns: Record<'form' | 'input', RegExp> = {
    form: /<form[^>]*>/gi,
    input: /<(?:input|textarea|select)[^>]*>/gi,
  };
  return (html.match(patterns[selector]) || []).length;
}

async function fetchPrivacyPolicyHtml(privacyPolicyUrl: string | null, baseUrl: string): Promise<string | null> {
  if (!privacyPolicyUrl) return null;
  try {
    const resolvedUrl = privacyPolicyUrl.startsWith('http') ? privacyPolicyUrl : new URL(privacyPolicyUrl, baseUrl).href;
    const response = await fetch(resolvedUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GDPRBot/1.0)' } });
    if (!response.ok) return null;
    return (await response.text()).slice(0, 200000);
  } catch {
    return null;
  }
}

function analysePrivacyPolicyHtml(html: string): Partial<CrawlResult> {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').toLowerCase();
  const processorNames = ['google analytics', 'google tag manager', 'facebook', 'meta', 'hotjar', 'stripe', 'mixpanel', 'segment', 'intercom', 'zendesk', 'hubspot', 'mailchimp', 'sendgrid', 'cloudflare', 'sentry'];
  const processorsFound = processorNames.filter((name) => text.includes(name));
  const userRightsFound = ['right of access', 'right to erasure', 'right to rectification', 'data portability', 'right to object', 'withdraw consent']
    .filter((term) => text.includes(term));
  const retentionMatch = text.match(/(retention period|retained for|kept for|storage period).{0,120}/i);

  return {
    hasCookiePolicyPage: text.includes('cookie policy'),
    processorDisclosure: processorsFound.length > 0,
    processorsFound,
    hasInternationalTransferDisclosure: ['standard contractual clause', 'scc', 'adequacy decision', 'international transfer', 'transferred to', 'united states'].some((term) => text.includes(term)),
    hasDataRetentionDisclosure: ['data retention', 'retention period', 'retained for', 'kept for', 'storage period'].some((term) => text.includes(term)),
    retentionDetails: retentionMatch?.[0] || null,
    userRightsMechanism: userRightsFound.length >= 3,
    userRightsFound,
    dpoContact: null,
    supervisoryAuthority: text.includes('supervisory authority') ? 'mentioned' : null,
    ageRestriction: text.includes('under 16') || text.includes('under 13') ? 'mentioned' : null,
    hasAutomatedDecisionMakingDisclosure: text.includes('automated decision'),
    hasConsentWithdrawalMechanism: text.includes('withdraw consent'),
  };
}

async function crawlPageForWorker(url: string): Promise<CrawlResult> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GDPRBot/1.0)' },
  });
  if (!response.ok) {
    console.warn(`[Worker] Non-OK crawl status ${response.status} for ${url}; continuing with response body.`);
  }

  const html = await response.text();
  if (!html || !html.trim()) {
    throw new Error(`Fetch returned empty body with status ${response.status}`);
  }
  const title = extractText(html, 'title');
  const description = extractMetaContent(html, 'description');
  const h1s = extractAllText(html, 'h1');
  const privacyLinks = extractLinksWithText(html, ['privacy', 'datenschutz', 'rgpd', 'privacy-policy']);
  let privacyPolicyUrl: string | null = null;
  if (privacyLinks.length > 0) {
    try {
      privacyPolicyUrl = privacyLinks[0].href.startsWith('http') ? privacyLinks[0].href : new URL(privacyLinks[0].href, url).href;
    } catch {
      privacyPolicyUrl = null;
    }
  }

  const bannerMatch = html.match(/<(?:div|section|p|span)[^>]+(?:class|id)=["'][^"']*(?:cookie|consent|gdpr)[^"']*["'][^>]*>([^<]{0,300})/i);
  const hasCookieBanner = Boolean(bannerMatch);
  const cookieBannerText = bannerMatch?.[1]?.trim().slice(0, 200) || null;

  const trackingPatterns = ['google-analytics', 'googletagmanager', 'facebook', 'fbpixel', 'hotjar', 'mixpanel', 'segment', 'intercom', 'drift', 'zendesk', 'analytics'];
  const trackingScripts: string[] = [];
  const scriptSrcRegex = /<script[^>]+src=["']([^"']+)["']/gi;
  let scriptMatch: RegExpExecArray | null;
  while ((scriptMatch = scriptSrcRegex.exec(html)) !== null) {
    const src = scriptMatch[1].toLowerCase();
    if (trackingPatterns.some((pattern) => src.includes(pattern))) trackingScripts.push(scriptMatch[1]);
  }

  const formsCount = countElements(html, 'form');
  const totalFormInputs = countElements(html, 'input');
  const labeledInputs = (html.match(/<input[^>]+id=["']([^"']+)["'][^>]*>/gi) || []).filter((inputTag) => {
    const idMatch = inputTag.match(/id=["']([^"']+)["']/);
    if (!idMatch) return false;
    const id = idMatch[1];
    return html.includes(`<label for="${id}"`) || html.includes(`<label for='${id}'`);
  }).length;

  const thirdPartyEmbeds: string[] = [];
  const iframeSrcRegex = /<iframe[^>]+src=["']([^"']+)["']/gi;
  let iframeMatch: RegExpExecArray | null;
  while ((iframeMatch = iframeSrcRegex.exec(html)) !== null) {
    const src = iframeMatch[1];
    if (src.includes('youtube.com') || src.includes('youtu.be')) thirdPartyEmbeds.push('YouTube embed');
    else if (src.includes('vimeo.com')) thirdPartyEmbeds.push('Vimeo embed');
    else if (src.includes('maps.google.com') || src.includes('google.com/maps')) thirdPartyEmbeds.push('Google Maps embed');
    else if (src.includes('instagram.com')) thirdPartyEmbeds.push('Instagram embed');
    else if (src.includes('twitter.com') || src.includes('platform.twitter')) thirdPartyEmbeds.push('Twitter embed');
  }

  const mixedContent = /<(?:img|script|link|iframe|source)[^>]+(?:src|href)=["'](http:[^"']+)["']/i.test(html);

  let marketingOptinStatus: CrawlResult['marketingOptinStatus'] = 'no_forms';
  if (formsCount > 0) {
    const marketingInputRegex = /<input[^>]+(?:id|name)=["'][^"']*(?:marketing|newsletter|consent|opt[- ]?in)[^"']*["'][^>]*>/gi;
    const marketingInputs = html.match(marketingInputRegex) || [];
    if (marketingInputs.length > 0) {
      const preChecked = marketingInputs.some((inputTag) => inputTag.includes('checked') || inputTag.includes('selected'));
      marketingOptinStatus = preChecked ? 'pre_checked' : 'present_not_prechecked';
    } else {
      marketingOptinStatus = 'missing';
    }
  }

  const securityHeaders: Record<string, string> = {};
  for (const key of ['content-security-policy', 'x-frame-options', 'x-content-type-options', 'referrer-policy', 'permissions-policy', 'strict-transport-security']) {
    const value = response.headers.get(key);
    if (value) securityHeaders[key] = value;
  }

  const privacyPolicyHtml = await fetchPrivacyPolicyHtml(privacyPolicyUrl, url);
  const policyAnalysis = privacyPolicyHtml ? analysePrivacyPolicyHtml(privacyPolicyHtml) : {};

  return {
    url,
    title,
    description,
    h1s,
    hasPrivacyPolicy: Boolean(privacyPolicyUrl),
    privacyPolicyUrl,
    privacyPolicyHtml,
    hasCookieBanner,
    cookieBannerText,
    trackingScripts,
    formsCount,
    formInputsLabeled: labeledInputs,
    totalFormInputs,
    hasSSL: url.startsWith('https://'),
    screenshots: [],
    html: html.slice(0, 50000),
    statusCode: response.status,
    securityHeaders,
    hasCookiePolicyPage: false,
    thirdPartyEmbeds: Array.from(new Set(thirdPartyEmbeds)),
    mixedContent,
    marketingOptinStatus,
    processorDisclosure: false,
    processorsFound: [],
    hasInternationalTransferDisclosure: false,
    hasDataRetentionDisclosure: false,
    retentionDetails: null,
    userRightsMechanism: false,
    userRightsFound: [],
    dpoContact: null,
    supervisoryAuthority: null,
    ageRestriction: null,
    hasAutomatedDecisionMakingDisclosure: false,
    hasConsentWithdrawalMechanism: false,
    ...policyAnalysis,
  };
}

function runRuleBasedChecks(crawlResult: CrawlResult): GdprCheck[] {
  const checks: GdprCheck[] = [];
  checks.push({
    id: 'ssl',
    name: 'SSL/HTTPS Encryption',
    description: 'Website must use HTTPS for secure data transmission',
    severity: 'critical',
    passed: crawlResult.hasSSL,
    detail: crawlResult.hasSSL ? 'Site uses HTTPS' : 'Site does not use HTTPS',
    recommendation: crawlResult.hasSSL ? '' : "Install an SSL certificate (Let's Encrypt is free)",
  });
  checks.push({
    id: 'privacy_policy',
    name: 'Privacy Policy Present',
    description: 'GDPR requires a clearly accessible privacy policy',
    severity: 'critical',
    passed: crawlResult.hasPrivacyPolicy,
    detail: crawlResult.hasPrivacyPolicy ? `Privacy policy found at: ${crawlResult.privacyPolicyUrl || 'linked on page'}` : 'No privacy policy link detected',
    recommendation: crawlResult.hasPrivacyPolicy ? '' : 'Add a privacy policy page and link it in the footer',
  });
  checks.push({
    id: 'cookie_consent',
    name: 'Cookie Consent Banner',
    description: 'EU law requires cookie consent before setting non-essential cookies',
    severity: 'critical',
    passed: crawlResult.hasCookieBanner,
    detail: crawlResult.hasCookieBanner ? `Cookie banner detected: "${(crawlResult.cookieBannerText || '').slice(0, 100)}"` : 'No cookie consent banner detected',
    recommendation: crawlResult.hasCookieBanner ? '' : 'Add a GDPR-compliant cookie consent banner',
  });
  checks.push({
    id: 'tracking_scripts',
    name: 'Third-Party Tracking Scripts',
    description: 'Tracking scripts require consent under GDPR',
    severity: crawlResult.trackingScripts.length > 0 ? 'warning' : 'info',
    passed: crawlResult.trackingScripts.length === 0,
    detail: crawlResult.trackingScripts.length > 0 ? `Found: ${crawlResult.trackingScripts.join(', ')}` : 'No known tracking scripts detected',
    recommendation: crawlResult.trackingScripts.length > 0 ? 'Ensure these scripts only load after explicit user consent.' : '',
  });
  checks.push({
    id: 'form_labels',
    name: 'Form Input Labels',
    description: 'Form inputs should have labels for accessibility and transparency',
    severity: 'warning',
    passed: crawlResult.totalFormInputs === 0 || (crawlResult.formInputsLabeled / Math.max(crawlResult.totalFormInputs, 1)) >= 0.8,
    detail: crawlResult.totalFormInputs === 0 ? 'No form inputs found' : `${crawlResult.formInputsLabeled}/${crawlResult.totalFormInputs} inputs have labels`,
    recommendation: crawlResult.totalFormInputs > 0 && (crawlResult.formInputsLabeled / Math.max(crawlResult.totalFormInputs, 1)) < 0.8 ? 'Add labels or aria-label attributes to form inputs' : '',
  });
  checks.push({
    id: 'security_headers',
    name: 'Security Headers',
    description: 'Security headers protect the site from common attacks',
    severity: Object.keys(crawlResult.securityHeaders).length >= 3 ? 'info' : 'warning',
    passed: Object.keys(crawlResult.securityHeaders).length > 0,
    detail: Object.keys(crawlResult.securityHeaders).length > 0 ? `Present: ${Object.keys(crawlResult.securityHeaders).join(', ')}` : 'No key security headers detected',
    recommendation: Object.keys(crawlResult.securityHeaders).length > 0 ? '' : 'Add CSP, X-Frame-Options, X-Content-Type-Options, and Referrer-Policy headers',
  });
  return checks;
}

function heuristicScoreFromFindings(ruleBasedChecks: any[], aiIssues: any[] = []): number {
  const failedChecks = (Array.isArray(ruleBasedChecks) ? ruleBasedChecks : []).filter((c) => c?.passed === false);
  const findings = [
    ...failedChecks.map((c) => ({ severity: c?.severity })),
    ...(Array.isArray(aiIssues) ? aiIssues : []),
  ];

  let critical = 0;
  let warning = 0;
  let info = 0;

  for (const finding of findings) {
    const severity = String(finding?.severity || '').toLowerCase();
    if (severity === 'critical' || severity === 'high') critical += 1;
    else if (severity === 'warning' || severity === 'medium') warning += 1;
    else info += 1;
  }

  const weightedSeverityPenalty = critical * 18 + warning * 8 + info * 2;
  const volumePenalty = Math.max(0, findings.length - 2) * 1.5;
  const criticalStackPenalty = critical >= 3 ? (critical - 2) * 3 : 0;

  const score = 100 - weightedSeverityPenalty - volumePenalty - criticalStackPenalty;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function riskFromScore(score: number): AiAnalysisResult['riskLevel'] {
  if (score >= 75) return 'low';
  if (score >= 50) return 'medium';
  return 'high';
}

function extractAiText(response: any): string {
  const choice = response?.choices?.[0];
  const content = choice?.message?.content
    ?? choice?.messages?.[0]?.content
    ?? choice?.text
    ?? response?.output_text
    ?? response?.result?.response
    ?? response?.response
    ?? '{}';

  if (Array.isArray(content)) {
    return content
      .map((part: any) => {
        if (typeof part === 'string') return part;
        if (typeof part?.text === 'string') return part.text;
        return '';
      })
      .join('');
  }

  return typeof content === 'string' ? content : JSON.stringify(content);
}

function stripHtmlToText(input: string | null | undefined): string {
  if (!input) return '';
  return input.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeIssueKey(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildFallbackIssues(ruleBasedChecks: any[]): AiAnalysisResult['issues'] {
  return (Array.isArray(ruleBasedChecks) ? ruleBasedChecks : [])
    .filter((c) => c?.passed === false)
    .slice(0, 8)
    .map((c) => ({
      title: String(c?.name || 'Failed compliance check'),
      description: String(c?.detail || 'A GDPR-related automated check failed.'),
      severity: (String(c?.severity || 'warning').toLowerCase() === 'critical' ? 'critical' : 'warning') as 'critical' | 'warning' | 'info',
      fix: String(c?.recommendation || 'Review this control and implement the required GDPR safeguard.'),
    }));
}

function dedupeAndFilterAiIssues(aiIssues: any[], ruleBasedChecks: any[]): AiAnalysisResult['issues'] {
  const failedRuleNames = new Set(
    (Array.isArray(ruleBasedChecks) ? ruleBasedChecks : [])
      .filter((c) => c?.passed === false)
      .map((c) => normalizeIssueKey(String(c?.name || '')))
      .filter(Boolean)
  );

  const seen = new Set<string>();
  const out: AiAnalysisResult['issues'] = [];

  for (const issue of Array.isArray(aiIssues) ? aiIssues : []) {
    const title = String(issue?.title || '').trim();
    const description = String(issue?.description || '').trim();
    const fix = String(issue?.fix || '').trim();
    const severityRaw = String(issue?.severity || 'warning').toLowerCase();
    const severity: 'critical' | 'warning' | 'info' =
      severityRaw === 'critical' || severityRaw === 'high'
        ? 'critical'
        : severityRaw === 'warning' || severityRaw === 'medium'
          ? 'warning'
          : 'info';

    if (!title || !description) continue;

    const normalizedTitle = normalizeIssueKey(title);
    if (failedRuleNames.has(normalizedTitle)) continue;

    const dedupeKey = `${normalizedTitle}::${normalizeIssueKey(description).slice(0, 120)}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    out.push({ title, description, severity, fix });
  }

  return out;
}

async function analyzeWithWorkersAI(crawlResult: any, ruleBasedChecks: any[], ai: Ai): Promise<AiAnalysisResult> {
  const privacyPolicyExcerpt = stripHtmlToText(crawlResult.privacyPolicyHtml).slice(0, 5000);
  const truncated = {
    ...crawlResult,
    html: crawlResult.html ? crawlResult.html.substring(0, 8000) + '...[truncated]' : '',
    privacyPolicyHtml: privacyPolicyExcerpt || null,
    trackingScripts: Array.isArray(crawlResult.trackingScripts) ? crawlResult.trackingScripts.slice(0, 25) : [],
    thirdPartyEmbeds: Array.isArray(crawlResult.thirdPartyEmbeds) ? crawlResult.thirdPartyEmbeds.slice(0, 25) : [],
    screenshots: [],
  };

  const prompt = `You are a senior GDPR compliance auditor. Analyze this website scan data and provide a deep, concrete assessment.

SCAN DATA:
${JSON.stringify(truncated, null, 2)}

RULE-BASED CHECKS ALREADY PERFORMED:
${JSON.stringify(ruleBasedChecks, null, 2)}

IMPORTANT:
- Do NOT repeat rule-based failed checks as AI issues.
- AI issues must be ADDITIONAL findings that go beyond the listed rule checks.
- Prefer specific, evidence-based findings tied to GDPR duties (consent validity, transparency, user rights, data retention, processors/transfers, security by design).
- Provide at least 4 issues when genuine risks are visible; otherwise return fewer with clear justification in summary.

Return a JSON object with this exact structure:
{
  "summary": "2-3 sentence executive summary of compliance posture",
  "riskLevel": "low | medium | high",
  "issues": [{"title": "Issue title", "description": "What the problem is and why it matters under GDPR", "severity": "critical | warning | info", "fix": "Specific action to fix this issue"}],
  "positives": ["List of things done well from a GDPR perspective"],
  "gdprScore": 0-100
}`;

  const fallbackScore = heuristicScoreFromFindings(ruleBasedChecks);
  const fallbackIssues = buildFallbackIssues(ruleBasedChecks);
  const fallbackResult: AiAnalysisResult = {
    summary: 'AI analysis unavailable. Showing enriched rule-based fallback findings.',
    riskLevel: riskFromScore(fallbackScore),
    issues: fallbackIssues,
    positives: [],
    gdprScore: fallbackScore,
  };

  if (!ai) {
    return fallbackResult;
  }

  try {
    const response = await ai.run('@cf/minimax/m2.5', {
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 1200,
    });

    let content = extractAiText(response);
    content = content.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '').replace(/^```json\s*/i, '').replace(/^```\s*/i, '').trim();
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) content = jsonMatch[0];
    content = content.replace(/,(\s*[}\]])/g, '$1').replace(/[\x00-\x1F\x7F]/g, '');

    try {
      const parsed = JSON.parse(content) as AiAnalysisResult;
      if (parsed.gdprScore === undefined || !parsed.issues) throw new Error('Invalid AI response shape');

      const filteredIssues = dedupeAndFilterAiIssues(parsed.issues || [], ruleBasedChecks);
      const computedScore = heuristicScoreFromFindings(ruleBasedChecks, filteredIssues || []);
      return {
        ...parsed,
        issues: filteredIssues,
        gdprScore: computedScore,
        riskLevel: riskFromScore(computedScore),
      };
    } catch {
      console.error('[Worker] AI parse failed, using fallback:', content.substring(0, 200));
      return fallbackResult;
    }
  } catch (err) {
    console.error('[Worker] AI invocation failed, using fallback:', err);
    return fallbackResult;
  }
}

async function compressGzipBase64(text: string): Promise<string> {
  const encoded = new TextEncoder().encode(text);
  const cs = new CompressionStream('gzip');
  const writer = cs.writable.getWriter();
  await writer.write(encoded);
  await writer.close();
  const response = new Response(cs.readable);
  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function sendHtmlEmail(env: Env, input: { email: string; subject: string; html: string; name?: string }): Promise<void> {
  const apiKey = env.MAILJET_API_KEY;
  const secretKey = env.MAILJET_SECRET_KEY;
  if (!apiKey || !secretKey) throw new Error('Mailjet credentials missing on worker');

  const credentials = btoa(`${apiKey}:${secretKey}`);
  const resp = await fetch('https://api.mailjet.com/v3.1/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${credentials}`,
    },
    body: JSON.stringify({
      Messages: [{
        From: { Email: 'hello@complyscan.ch', Name: 'ComplyScan' },
        To: [{ Email: input.email, Name: input.name || undefined }],
        Subject: input.subject,
        HTMLPart: input.html,
      }],
    }),
  });

  if (!resp.ok) {
    const detail = await resp.text().catch(() => '');
    throw new Error(`Mailjet send failed (${resp.status}): ${detail}`);
  }
}

async function sendReportEmail(env: Env, email: string, url: string, result: any): Promise<void> {
  try {
    const html = `<html><body><h1>ComplyScan Report</h1><p>URL: ${url}</p><p>Score: ${result.aiAnalysis?.gdprScore ?? 50}</p></body></html>`;
    await sendHtmlEmail(env, {
      email,
      subject: `GDPR Compliance Report for ${url}`,
      html,
    });
  } catch (err) {
    console.error('[Worker] Failed to send report email:', err);
  }
}





