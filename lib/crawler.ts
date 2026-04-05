import 'server-only';
import puppeteer, { Browser } from 'puppeteer-core';

// Edge/Workers runtimes cannot rely on launching a local browser binary.
// Detect both Cloudflare Pages and standalone Workers so we prefer fetch/browserless paths there.
const IS_EDGE_RUNTIME = !!process.env.CF_PAGES || typeof (globalThis as any).WebSocketPair !== 'undefined';

export interface CrawlResult {
  url: string;
  title: string;
  description: string;
  h1s: string[];
  hasPrivacyPolicy: boolean;
  privacyPolicyUrl: string | null;
  privacyPolicyHtml: string | null;        // NEW: full HTML of privacy policy page
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
  // NEW: security headers from HTTP response
  securityHeaders: Record<string, string>;
  // NEW: GDPR policy content checks
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

function extractText(html: string, tag: string, maxLen = 200): string {
  const match = html.match(new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`, 'i'));
  return match ? match[1].trim().slice(0, maxLen) : '';
}

function extractAllText(html: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`, 'gi');
  const results: string[] = [];
  let match;
  while ((match = regex.exec(html)) !== null) {
    results.push(match[1].trim());
  }
  return results;
}

function extractMetaContent(html: string, name: string): string {
  const patterns = [
    new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`, 'i'),
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m) return m[1].trim().slice(0, 500);
  }
  return '';
}

function extractLinksWithText(html: string, patterns: string[]): Array<{ href: string; text: string }> {
  const results: Array<{ href: string; text: string }> = [];
  const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi;
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1];
    const text = match[2].toLowerCase();
    if (patterns.some(p => href.toLowerCase().includes(p) || text.includes(p))) {
      results.push({ href, text });
    }
  }
  return results;
}

function countElements(html: string, selector: string): number {
  const patterns: Record<string, RegExp> = {
    'form': /<form[^>]*>/gi,
    'input': /<(?:input|textarea|select)[^>]*>/gi,
    'script-src': /<script[^>]+src=["']([^"']+)["']/gi,
  };
  const regex = patterns[selector];
  if (!regex) return 0;
  const matches = html.match(regex);
  return matches ? matches.length : 0;
}

// ── Privacy Policy HTML fetcher ─────────────────────────────────────────────────
async function fetchPrivacyPolicyHtml(privacyPolicyUrl: string | null, baseUrl: string): Promise<string | null> {
  if (!privacyPolicyUrl) return null;
  try {
    const resolvedUrl = privacyPolicyUrl.startsWith('http')
      ? privacyPolicyUrl
      : new URL(privacyPolicyUrl, baseUrl).href;
    const timeoutMs = 15000;
    const resp = await new Promise<Response>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Privacy policy fetch timeout')), timeoutMs);
      fetch(resolvedUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GDPRBot/1.0)' } })
        .then(r => { clearTimeout(timer); resolve(r); })
        .catch(e => { clearTimeout(timer); reject(e); });
    });
    if (resp.ok) {
      const text = await resp.text();
      return text.slice(0, 200000); // cap at 200KB
    }
  } catch { /* non-fatal */ }
  return null;
}

// ── GDPR policy content analyser ──────────────────────────────────────────────
function analysePrivacyPolicyHtml(html: string): Partial<CrawlResult> {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').toLowerCase();

  // Cookie policy page
  const cookiePagePatterns = ['cookie policy', 'cookie-policy', 'cookies policy', 'politique de cookies', 'cookie-hinweis'];
  const hasCookiePolicyPage = cookiePagePatterns.some(p =>
    text.includes(p) && html.match(/<(?:h[1-6]|p|div)[^>]+(?:class|id)=["'][^"']*(?:cookie|cookie-policy)[^"']*["']/i)
  );

  // Third-party embeds in the main page HTML (not privacy policy)
  // Data processors to check for
  const knownProcessors = [
    'google analytics', 'google tag manager', 'facebook', 'meta', 'hotjar',
    'stripe', 'mixpanel', 'segment', 'intercom', 'zendesk', 'hubspot',
    'mailchimp', 'sendgrid', 'crisp', 'drift', 'old ogm',
    'cloudflare', 'new relic', 'datadog', 'sentry', 'optimizely',
  ];

  const processorRegex = new RegExp(`(${knownProcessors.join('|')})`, 'gi');
  const processorMatches = new Set<string>();
  let pm;
  while ((pm = processorRegex.exec(text)) !== null) {
    processorMatches.add(pm[1].trim());
  }

  // International transfer disclosure
  const transferKeywords = [
    'standard contractual clause', 'scc', 'adequacy decision',
    'eu-us data transfers', 'international transfer', 'data transferred',
    'transferred to', 'united states', 'us-based',
  ];
  const hasInternationalTransferDisclosure = transferKeywords.some(k => text.includes(k));

  // Data retention disclosure
  const retentionKeywords = [
    'data retention', 'retention period', 'retained for', 'kept for',
    'delete after', 'deletion after', 'storage period', 'how long we keep',
  ];
  const hasDataRetentionDisclosure = retentionKeywords.some(k => text.includes(k));
  // Extract a snippet near the retention keyword
  let retentionDetails: string | null = null;
  for (const kw of retentionKeywords) {
    const idx = text.indexOf(kw);
    if (idx !== -1) {
      retentionDetails = html.slice(Math.max(0, idx - 50), idx + 150)
        .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      break;
    }
  }

  // User rights mechanism
  const rightKeywords = [
    { phrase: 'right of access', key: 'access' },
    { phrase: 'right to erasure', key: 'erasure' },
    { phrase: 'right to be forgotten', key: 'erasure' },
    { phrase: 'right to rectification', key: 'rectification' },
    { phrase: 'data portability', key: 'portability' },
    { phrase: 'right to object', key: 'objection' },
    { phrase: 'withdraw consent', key: 'withdraw consent' },
    { phrase: 'right to restriction', key: 'restriction' },
    { phrase: ' lodge a complaint', key: 'complaint' },
  ];
  const userRightsFound: string[] = [];
  for (const { phrase, key } of rightKeywords) {
    if (text.includes(phrase)) userRightsFound.push(key);
  }
  const userRightsMechanism = userRightsFound.length >= 3;

  // DPO contact
  let dpoContact: string | null = null;
  const dpoPatterns = [
    /data protection officer[:\s]+([^\n<]{5,100})/gi,
    /dpo[:\s]+([^\n<]{5,100})/gi,
    /DPO\s*[:\-]?\s*([^\n<]{5,100})/gi,
    /datenschutzbeauftragte[rr]?[:\s]+([^\n<]{5,100})/gi,
  ];
  for (const pat of dpoPatterns) {
    const m = html.match(pat);
    if (m) { dpoContact = m[1].trim(); break; }
  }
  // Also look for dpo@ email
  if (!dpoContact) {
    const emailMatch = html.match(/dpo[.@][^\s<>"]{5,50}/i);
    if (emailMatch) dpoContact = emailMatch[0].trim();
  }
  // Check for explicit "DPO not required"
  const dpoNotRequired = /dpo\s+(?:not\s+)?(?:required|applicable|appointed|necessary)|no\s+dpo\s+required/i.test(text);
  if (!dpoContact && dpoNotRequired) dpoContact = 'not_applicable';

  // Supervisory authority
  const supervisoryPatterns = [
    /(?:supervisory authority|regulator|data protection authority)[:\s]+([^\n<]{3,80})/gi,
    /right to lodge a complaint with\s+([^\n<]{3,80})/gi,
    /(?:information commissioner|ico|bsb|dsa)[:\s]+([^\n<]{3,80})/gi,
  ];
  let supervisoryAuthority: string | null = null;
  for (const pat of supervisoryPatterns) {
    const m = html.match(pat);
    if (m) { supervisoryAuthority = m[1].trim(); break; }
  }
  // Also check for specific EU supervisory authorities by name
  const euRegulators = [
    'irish data protection commission', 'commission nationale de l\'informatique et des libertés',
    'bayerisches landesamt', 'garante per la protezione dei dati personali',
    ' autoriteit persoonsgegevens', 'datatilsynet', 'ico', 'information commissioner',
  ];
  for (const reg of euRegulators) {
    if (text.includes(reg)) { supervisoryAuthority = reg; break; }
  }

  // Age restriction
  let ageRestriction: string | null = null;
  const agePatterns = [
    /(?:not\s+for|not intended for|restricted to|children|under\s*(?:16|13|18))[^\n.]{0,100}/gi,
    /(?:minimum\s+age|age\s+verification|age\s+restriction)[^\n.]{0,80}/gi,
    /(?:parental consent|parent['\s]?s?\s*consent)[^\n.]{0,80}/gi,
  ];
  for (const pat of agePatterns) {
    const m = html.match(pat);
    if (m && m[1].trim().length > 5) { ageRestriction = m[1].trim(); break; }
  }

  // Automated decision-making (Art. 22)
  const art22Patterns = [
    'automated decision-making', 'automated decision', 'profiling',
    'art. 22', 'article 22', 'art 22',
    'solely automated decision', 'significant effects',
  ];
  const hasAutomatedDecisionMakingDisclosure = art22Patterns.some(k => text.includes(k));

  // Consent withdrawal
  const withdrawalPatterns = [
    'withdraw consent', 'withdrawal of consent', 'revoke consent',
    'opt out', 'unsubscribe', 'stop processing',
  ];
  const hasConsentWithdrawalMechanism = withdrawalPatterns.some(k => text.includes(k));

  return {
    hasCookiePolicyPage,
    processorDisclosure: processorMatches.size > 0,
    processorsFound: Array.from(processorMatches),
    hasInternationalTransferDisclosure,
    hasDataRetentionDisclosure,
    retentionDetails,
    userRightsMechanism,
    userRightsFound,
    dpoContact,
    supervisoryAuthority,
    ageRestriction: ageRestriction ? 'present' : null,
    hasAutomatedDecisionMakingDisclosure,
    hasConsentWithdrawalMechanism,
  };
}

// ── Browser-based crawl ───────────────────────────────────────────────────────
async function crawlWithBrowser(url: string): Promise<CrawlResult> {
  // On Cloudflare Pages Workers: no Chrome installed, must use Browserless
  // Locally: use Puppeteer with system Chrome
  if (IS_EDGE_RUNTIME) {
    return await crawlWithBrowserless(url);
  } else {
    return await crawlWithPuppeteerLocal(url);
  }
}

async function crawlWithBrowserless(url: string): Promise<CrawlResult> {
  const apiKey = process.env.BROWSERLESS_API_KEY;
  if (!apiKey) {
    throw new Error('BROWSERLESS_API_KEY not configured');
  }

  const browserlessUrl = `https://chrome.browserless.io/content?token=${apiKey}`;
  const timeoutMs = 30000;

  // Fetch HTML via Browserless (handles JS-rendered pages)
  let html: string;
  let statusCode = 200;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const resp = await fetch(browserlessUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ url, gotoOptions: { waitUntil: 'networkidle2', timeout: 25000 } }),
    });
    clearTimeout(timer);
    if (!resp.ok) {
      throw new Error(`Browserless error ${resp.status}: ${await resp.text().catch(() => '')}`);
    }
    const contentType = resp.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await resp.json() as { data?: string; html?: string; content?: string; statusCode?: number };
      html = (data.data || data.html || data.content || '').slice(0, 50000);
      if (data.statusCode) statusCode = data.statusCode;
    } else {
      html = (await resp.text()).slice(0, 50000);
    }
  } catch (err: any) {
    throw new Error(`Browserless crawl failed: ${err.message}`);
  }

  if (!html || html.length < 100) {
    throw new Error('Browserless returned empty content');
  }

  // Parse the HTML (same extraction logic as crawlWithFetch)
  const securityHeaders: Record<string, string> = {};
  const title = extractText(html, 'title');
  const description = extractMetaContent(html, 'description');
  const h1s = extractAllText(html, 'h1');
  const hasSSL = url.startsWith('https://');

  const privacyLinks = extractLinksWithText(html, ['privacy', 'datenschutz', 'rgpd', 'privacidade', 'politique', 'privacy-policy', 'privacitat']);
  let privacyPolicyUrl: string | null = null;
  if (privacyLinks.length > 0) {
    const first = privacyLinks[0];
    try {
      privacyPolicyUrl = first.href.startsWith('http') ? first.href : new URL(first.href, url).href;
    } catch { privacyPolicyUrl = null; }
  }

  // Cookie banner
  const cookiePatterns = ['cookie', 'consent', 'gdpr', 'ccpa', 'notice', 'banner', 'accept', 'agree'];
  let hasCookieBanner = false;
  let cookieBannerText: string | null = null;
  for (const pattern of cookiePatterns) {
    const bannerRegex = new RegExp(`<(?:div|section|p|span)[^>]+(?:class|id)=["'][^"']*${pattern}[^"']*["'][^>]*>([^<]{0,300})`, 'i');
    const match = html.match(bannerRegex);
    if (match) { hasCookieBanner = true; cookieBannerText = match[1].trim().slice(0, 200); break; }
  }

  const trackingPatterns = ['google-analytics', 'googletagmanager', 'facebook', 'fbpixel', 'hotjar', 'mixpanel', 'segment', 'intercom', 'drift', 'zendesk', 'analytics'];
  const trackingScripts: string[] = [];
  const scriptSrcRegex = /<script[^>]+src=["']([^"']+)["']/gi;
  let scriptMatch;
  while ((scriptMatch = scriptSrcRegex.exec(html)) !== null) {
    const src = scriptMatch[1].toLowerCase();
    if (trackingPatterns.some(p => src.includes(p))) trackingScripts.push(scriptMatch[1]);
  }

  const formsCount = countElements(html, 'form');
  const totalFormInputs = countElements(html, 'input');

  const thirdPartyEmbeds: string[] = [];
  const iframeSrcRegex = /<iframe[^>]+src=["']([^"']+)["']/gi;
  let iframeMatch;
  while ((iframeMatch = iframeSrcRegex.exec(html)) !== null) {
    const src = iframeMatch[1];
    if (src.includes('youtube.com') || src.includes('youtu.be')) thirdPartyEmbeds.push('YouTube embed');
    else if (src.includes('vimeo.com')) thirdPartyEmbeds.push('Vimeo embed');
    else if (src.includes('maps.google.com') || src.includes('google.com/maps')) thirdPartyEmbeds.push('Google Maps embed');
    else if (src.includes('instagram.com')) thirdPartyEmbeds.push('Instagram embed');
    else if (src.includes('twitter.com') || src.includes('platform.twitter')) thirdPartyEmbeds.push('Twitter embed');
  }

  const mixedContentRegex = /<(?:img|script|link|iframe|source)[^>]+(?:src|href)=["'](http:[^"']+)["']/gi;
  const mixedContent = mixedContentRegex.test(html);

  let marketingOptinStatus: 'present_not_prechecked' | 'pre_checked' | 'missing' | 'no_forms' = 'no_forms';
  if (formsCount > 0) {
    const marketingInputRegex = /<input[^>]+(?:id|name)=["'][^"']*(?:marketing|newsletter|consent|opt[- ]?in)[^"']*["'][^>]*>/gi;
    const marketingInputs = html.match(marketingInputRegex) || [];
    if (marketingInputs.length > 0) {
      const preChecked = marketingInputs.some(inp => inp.includes('checked') || inp.includes('selected'));
      marketingOptinStatus = preChecked ? 'pre_checked' : 'present_not_prechecked';
    } else {
      marketingOptinStatus = 'missing';
    }
  }

  // Fetch privacy policy HTML via Browserless
  let privacyPolicyHtml: string | null = null;
  if (privacyPolicyUrl) {
    try {
      const ppController = new AbortController();
      const ppTimer = setTimeout(() => ppController.abort(), 15000);
      const ppResp = await fetch(browserlessUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: ppController.signal,
        body: JSON.stringify({ url: privacyPolicyUrl, gotoOptions: { waitUntil: 'domcontentloaded', timeout: 10000 } }),
      });
      clearTimeout(ppTimer);
      if (ppResp.ok) {
        const ct = ppResp.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          const ppData = await ppResp.json() as { data?: string; html?: string };
          privacyPolicyHtml = (ppData.data || ppData.html || '').slice(0, 200000);
        } else {
          privacyPolicyHtml = (await ppResp.text()).slice(0, 200000);
        }
      }
    } catch { /* non-fatal */ }
  }

  const policyAnalysis = privacyPolicyHtml ? analysePrivacyPolicyHtml(privacyPolicyHtml) : {};

  return {
    url,
    title,
    description,
    h1s,
    hasPrivacyPolicy: !!privacyPolicyUrl,
    privacyPolicyUrl,
    privacyPolicyHtml,
    hasCookieBanner,
    cookieBannerText,
    trackingScripts,
    formsCount,
    formInputsLabeled: 0,
    totalFormInputs,
    hasSSL,
    screenshots: [],
    html,
    statusCode,
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

async function crawlWithPuppeteerLocal(url: string): Promise<CrawlResult> {
  let browser: Browser | null = null;

  browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || '/usr/bin/chromium-browser',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  const response = await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  const statusCode = response?.status() || 0;

  // Security headers
  const securityHeaders: Record<string, string> = {};
  const rawHeaders = response?.headers() || {};
  const securityHeaderKeys = [
    'content-security-policy', 'x-frame-options', 'x-content-type-options',
    'referrer-policy', 'permissions-policy', 'strict-transport-security',
  ];
  for (const key of securityHeaderKeys) {
    if (rawHeaders[key]) securityHeaders[key] = rawHeaders[key];
  }

  const title = await page.title();
  const description = await page.$eval('meta[name="description"]', el => el.getAttribute('content') || '').catch(() => '');

  const h1s = await page.$$eval('h1', els => els.map(el => el.textContent?.trim() || ''));

  const privacyLink = await page.$('a[href*="privacy"], a[href*="datenschutz"], a[href*="rgpd"]');
  const privacyPolicyUrl = privacyLink ? await privacyLink.evaluate(el => (el as HTMLAnchorElement).href) : null;
  const hasPrivacyPolicy = !!privacyLink;

  const cookieBanner = await page.$('[class*="cookie"], [id*="cookie"], [class*="consent"], [id*="consent"], [class*="gdpr"], [id*="gdpr"]');
  const cookieBannerText = cookieBanner ? await cookieBanner.evaluate(el => el.textContent?.trim() || '') : null;
  const hasCookieBanner = !!cookieBanner;

  const scripts = await page.$$eval('script[src]', els => els.map(el => el.getAttribute('src') || ''));
  const trackingPatterns = ['google-analytics', 'googletagmanager', 'facebook', 'fbpixel', 'hotjar', 'mixpanel', 'segment', 'intercom', 'drift', 'zendesk'];
  const trackingScripts = scripts.filter(src => trackingPatterns.some(p => src.toLowerCase().includes(p)));

  const forms = await page.$$('form');
  const formsCount = forms.length;
  const allInputs = await page.$$('input, textarea, select');
  const totalFormInputs = allInputs.length;
  const labeledInputs = await page.$$eval('input, textarea, select', els =>
    els.filter(el => {
      const id = el.getAttribute('id');
      const ariaLabel = el.getAttribute('aria-label');
      const ariaLabelledby = el.getAttribute('aria-labelledby');
      const hasLabel = !!id && !!document.querySelector(`label[for="${id}"]`);
      return !!(id && (ariaLabel || ariaLabelledby || hasLabel));
    }).length
  );

  // Third-party embeds
  const embedIframes = await page.$$eval('iframe[src]', els =>
    els.map(el => (el as HTMLIFrameElement).src)
  );
  const thirdPartyEmbeds: string[] = [];
  for (const src of embedIframes) {
    if (src.includes('youtube.com') || src.includes('youtu.be')) thirdPartyEmbeds.push('YouTube embed');
    else if (src.includes('vimeo.com')) thirdPartyEmbeds.push('Vimeo embed');
    else if (src.includes('maps.google.com') || src.includes('google.com/maps')) thirdPartyEmbeds.push('Google Maps embed');
    else if (src.includes('instagram.com')) thirdPartyEmbeds.push('Instagram embed');
    else if (src.includes('twitter.com') || src.includes('platform.twitter')) thirdPartyEmbeds.push('Twitter embed');
  }
  // Also check script embeds
  const allScripts = await page.$$eval('script[src], script:not([src])', els => els.map(el => el.textContent || ''));
  if (allScripts.some(s => s.includes('platform.twitter.com/widgets'))) thirdPartyEmbeds.push('Twitter widget');
  if (allScripts.some(s => s.includes('instagram.com/embed'))) thirdPartyEmbeds.push('Instagram embed');

  // Mixed content check
  const mixedContent = await page.evaluate(() => {
    const httpResources = Array.from(document.querySelectorAll('[src^="http:"], [href^="http:"], link[href^="http:"], img[src^="http:"]'));
    return httpResources.length > 0;
  });

  // Marketing opt-in on forms
  let marketingOptinStatus: 'present_not_prechecked' | 'pre_checked' | 'missing' | 'no_forms' = 'no_forms';
  if (formsCount > 0) {
    const marketingInputs = await page.$$eval('form input[type="checkbox"], form input[type="radio"]', els =>
      els.filter(el => {
        const name = (el as HTMLInputElement).name.toLowerCase();
        const id = el.getAttribute('id') || '';
        const className = (el.closest('form')?.className || '') + (el.className || '');
        const label = (el.closest('label')?.textContent || '').toLowerCase();
        return name.includes('marketing') || name.includes('newsletter') || name.includes('consent')
          || name.includes('opt-in') || id.includes('marketing') || id.includes('newsletter')
          || className.includes('marketing') || className.includes('newsletter')
          || label.includes('marketing') || label.includes('newsletter') || label.includes('consent');
      })
    );
    if (marketingInputs.length > 0) {
      const firstInput = marketingInputs[0] as HTMLInputElement;
      marketingOptinStatus = firstInput.checked ? 'pre_checked' : 'present_not_prechecked';
    } else {
      marketingOptinStatus = 'missing';
    }
  }

  const hasSSL = url.startsWith('https://');

  const screenshot = await page.screenshot({ encoding: 'base64', fullPage: false });

  const html = await page.content();
  const trimmedHtml = html.slice(0, 50000);

  await browser.close();

  // Fetch privacy policy HTML
  const privacyPolicyHtml = await fetchPrivacyPolicyHtml(privacyPolicyUrl, url);

  const policyAnalysis = privacyPolicyHtml
    ? analysePrivacyPolicyHtml(privacyPolicyHtml)
    : {};

  return {
    url,
    title,
    description,
    h1s,
    hasPrivacyPolicy,
    privacyPolicyUrl,
    privacyPolicyHtml,
    hasCookieBanner,
    cookieBannerText,
    trackingScripts,
    formsCount,
    formInputsLabeled: labeledInputs,
    totalFormInputs,
    hasSSL,
    screenshots: [screenshot],
    html: trimmedHtml,
    statusCode,
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

// ── Fetch-based crawl (fallback) ───────────────────────────────────────────────
async function crawlWithFetch(url: string): Promise<CrawlResult> {
  const timeoutMs = 15000;

  let response: Response;
  try {
    response = await new Promise<Response>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`Fetch timeout after ${timeoutMs}ms`)), timeoutMs);
      fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; GDPRBot/1.0)',
        },
      }).then(resp => {
        clearTimeout(timeout);
        resolve(resp);
      }).catch(err => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  } catch (fetchErr: any) {
    // Last resort: try curl (system binary — may bypass serverless network restrictions)
    let curlHtml: string | null = null;
    try {
       
      const { execSync } = require('child_process') as { execSync: (cmd: string, opts: any) => string };
      const curlTimeout = Math.floor(timeoutMs / 1000);
      const curlCmd = `curl -s -L --max-time ${curlTimeout} -A "GDPRBot/1.0" --fail "${url}" 2>&1`;
      const result = execSync(curlCmd, { timeout: timeoutMs + 2000, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
      if (result && result.length > 100) curlHtml = result as string;
    } catch { /* curl also failed */ }
    if (curlHtml) {
      // curl succeeded — manually parse the HTML
      const html = curlHtml;
      const statusCode = 200;
      const baseUrl = url;
      const securityHeaders: Record<string, string> = {};
      const title = extractText(html, 'title');
      const description = extractMetaContent(html, 'description');
      const h1s = extractAllText(html, 'h1');
      const privacyLinks = extractLinksWithText(html, ['privacy', 'datenschutz', 'rgpd', 'privacidade', 'politique', 'privacy-policy', 'privacitat']);
      let privacyPolicyUrl: string | null = null;
      if (privacyLinks.length > 0) {
        const first = privacyLinks[0];
        try {
          privacyPolicyUrl = first.href.startsWith('http') ? first.href : new URL(first.href, baseUrl).href;
        } catch { privacyPolicyUrl = null; }
      }
      const cookiePatterns = ['cookie', 'consent', 'gdpr', 'ccpa', 'notice', 'banner', 'accept', 'agree'];
      let hasCookieBanner = false;
      let cookieBannerText: string | null = null;
      for (const pattern of cookiePatterns) {
        const bannerRegex = new RegExp(`<(?:div|section|p|span)[^>]+(?:class|id)=["'][^"']*${pattern}[^"']*["'][^>]*>([^<]{0,300})`, 'i');
        const match = html.match(bannerRegex);
        if (match) { hasCookieBanner = true; cookieBannerText = match[1].trim().slice(0, 200); break; }
      }
      const trackingPatterns = ['google-analytics', 'googletagmanager', 'facebook', 'fbpixel', 'hotjar', 'mixpanel', 'segment', 'intercom', 'drift', 'zendesk', 'analytics'];
      const trackingScripts: string[] = [];
      const scriptSrcRegex = /<script[^>]+src=["']([^"']+)["']/gi;
      let scriptMatch;
      while ((scriptMatch = scriptSrcRegex.exec(html)) !== null) {
        const src = scriptMatch[1].toLowerCase();
        if (trackingPatterns.some(p => src.includes(p))) trackingScripts.push(scriptMatch[1]);
      }
      const formsCount = countElements(html, 'form');
      const totalFormInputs = countElements(html, 'input');
      const labeledInputs = (html.match(/<input[^>]+id=["']([^"']+)["'][^>]*>/gi) || []).filter(inp => {
        const idMatch = inp.match(/id=["']([^"']+)["']/);
        if (!idMatch) return false;
        const id = idMatch[1];
        return html.includes(`<label for="${id}"`) || html.includes(`<label for='${id}'`);
      }).length;
      const thirdPartyEmbeds: string[] = [];
      const iframeSrcRegex = /<iframe[^>]+src=["']([^"']+)["']/gi;
      let iframeMatch;
      while ((iframeMatch = iframeSrcRegex.exec(html)) !== null) {
        const src = iframeMatch[1];
        if (src.includes('youtube.com') || src.includes('youtu.be')) thirdPartyEmbeds.push('YouTube embed');
        else if (src.includes('vimeo.com')) thirdPartyEmbeds.push('Vimeo embed');
        else if (src.includes('maps.google.com') || src.includes('google.com/maps')) thirdPartyEmbeds.push('Google Maps embed');
        else if (src.includes('instagram.com')) thirdPartyEmbeds.push('Instagram embed');
        else if (src.includes('twitter.com') || src.includes('platform.twitter')) thirdPartyEmbeds.push('Twitter embed');
      }
      const mixedContentRegex = /<(?:img|script|link|iframe|source)[^>]+(?:src|href)=["'](http:[^"']+)["']/gi;
      const mixedContent = mixedContentRegex.test(html);
      let marketingOptinStatus: 'present_not_prechecked' | 'pre_checked' | 'missing' | 'no_forms' = 'no_forms';
      if (formsCount > 0) {
        const marketingInputRegex = /<input[^>]+(?:id|name)=["'][^"']*(?:marketing|newsletter|consent|opt[- ]?in)[^"']*["'][^>]*>/gi;
        const marketingInputs = html.match(marketingInputRegex) || [];
        if (marketingInputs.length > 0) {
          const preChecked = marketingInputs.some(inp => inp.includes('checked') || inp.includes('selected'));
          marketingOptinStatus = preChecked ? 'pre_checked' : 'present_not_prechecked';
        } else {
          marketingOptinStatus = 'missing';
        }
      }
      const privacyPolicyHtml = await fetchPrivacyPolicyHtml(privacyPolicyUrl, url);
      const policyAnalysis = privacyPolicyHtml ? analysePrivacyPolicyHtml(privacyPolicyHtml) : {};
      return {
        url,
        title,
        description,
        h1s,
        hasPrivacyPolicy: !!privacyPolicyUrl,
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
        statusCode,
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
    throw new Error(`Fetch failed: ${fetchErr.message}`);
  }

  const html = await response.text();
  const statusCode = response.status;
  const baseUrl = url;

  // Security headers from response
  const securityHeaders: Record<string, string> = {};
  const securityHeaderKeys = [
    'content-security-policy', 'x-frame-options', 'x-content-type-options',
    'referrer-policy', 'permissions-policy', 'strict-transport-security',
  ];
  for (const key of securityHeaderKeys) {
    const val = response.headers.get(key);
    if (val) securityHeaders[key] = val;
  }

  // Extract title
  const title = extractText(html, 'title');

  // Extract meta description
  const description = extractMetaContent(html, 'description');

  // Extract H1s
  const h1s = extractAllText(html, 'h1');

  // Privacy policy links
  const privacyLinks = extractLinksWithText(html, ['privacy', 'datenschutz', 'rgpd', 'privacidade', 'politique', 'privacy-policy', 'privacitat']);
  let privacyPolicyUrl: string | null = null;
  if (privacyLinks.length > 0) {
    const first = privacyLinks[0];
    try {
      privacyPolicyUrl = first.href.startsWith('http') ? first.href : new URL(first.href, baseUrl).href;
    } catch {
      privacyPolicyUrl = null;
    }
  }

  // Cookie banner heuristic
  const cookiePatterns = ['cookie', 'consent', 'gdpr', 'ccpa', 'notice', 'banner', 'accept', 'agree'];
  let hasCookieBanner = false;
  let cookieBannerText: string | null = null;
  for (const pattern of cookiePatterns) {
    const bannerRegex = new RegExp(`<(?:div|section|p|span)[^>]+(?:class|id)=["'][^"']*${pattern}[^"']*["'][^>]*>([^<]{0,300})`, 'i');
    const match = html.match(bannerRegex);
    if (match) {
      hasCookieBanner = true;
      cookieBannerText = match[1].trim().slice(0, 200);
      break;
    }
  }

  // Tracking scripts
  const trackingPatterns = ['google-analytics', 'googletagmanager', 'facebook', 'fbpixel', 'hotjar', 'mixpanel', 'segment', 'intercom', 'drift', 'zendesk', 'analytics'];
  const trackingScripts: string[] = [];
  const scriptSrcRegex = /<script[^>]+src=["']([^"']+)["']/gi;
  let scriptMatch;
  while ((scriptMatch = scriptSrcRegex.exec(html)) !== null) {
    const src = scriptMatch[1].toLowerCase();
    if (trackingPatterns.some(p => src.includes(p))) {
      trackingScripts.push(scriptMatch[1]);
    }
  }

  // Forms and inputs
  const formsCount = countElements(html, 'form');
  const totalFormInputs = countElements(html, 'input');

  // Simple labeled input heuristic
  const labeledInputs = (html.match(/<input[^>]+id=["']([^"']+)["'][^>]*>/gi) || []).filter(inp => {
    const idMatch = inp.match(/id=["']([^"']+)["']/);
    if (!idMatch) return false;
    const id = idMatch[1];
    return html.includes(`<label for="${id}"`) || html.includes(`<label for='${id}'`);
  }).length;

  // Third-party embeds (iframes)
  const thirdPartyEmbeds: string[] = [];
  const iframeSrcRegex = /<iframe[^>]+src=["']([^"']+)["']/gi;
  let iframeMatch;
  while ((iframeMatch = iframeSrcRegex.exec(html)) !== null) {
    const src = iframeMatch[1];
    if (src.includes('youtube.com') || src.includes('youtu.be')) thirdPartyEmbeds.push('YouTube embed');
    else if (src.includes('vimeo.com')) thirdPartyEmbeds.push('Vimeo embed');
    else if (src.includes('maps.google.com') || src.includes('google.com/maps')) thirdPartyEmbeds.push('Google Maps embed');
    else if (src.includes('instagram.com')) thirdPartyEmbeds.push('Instagram embed');
    else if (src.includes('twitter.com') || src.includes('platform.twitter')) thirdPartyEmbeds.push('Twitter embed');
  }

  // Mixed content
  const mixedContentRegex = /<(?:img|script|link|iframe|source)[^>]+(?:src|href)=["'](http:[^"']+)["']/gi;
  const mixedContent = mixedContentRegex.test(html);

  // Marketing opt-in
  let marketingOptinStatus: 'present_not_prechecked' | 'pre_checked' | 'missing' | 'no_forms' = 'no_forms';
  if (formsCount > 0) {
    // Look for marketing/consent checkboxes
    const marketingInputRegex = /<input[^>]+(?:id|name)=["'][^"']*(?:marketing|newsletter|consent|opt[- ]?in)[^"']*["'][^>]*>/gi;
    const marketingInputs = html.match(marketingInputRegex) || [];
    if (marketingInputs.length > 0) {
      const preChecked = marketingInputs.some(inp => inp.includes('checked') || inp.includes('selected'));
      marketingOptinStatus = preChecked ? 'pre_checked' : 'present_not_prechecked';
    } else {
      marketingOptinStatus = 'missing';
    }
  }

  // Fetch privacy policy HTML
  const privacyPolicyHtml = await fetchPrivacyPolicyHtml(privacyPolicyUrl, url);
  const policyAnalysis = privacyPolicyHtml ? analysePrivacyPolicyHtml(privacyPolicyHtml) : {};

  return {
    url,
    title,
    description,
    h1s,
    hasPrivacyPolicy: !!privacyPolicyUrl,
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
    statusCode,
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

export async function crawlPage(url: string): Promise<CrawlResult> {
  // On Cloudflare Pages Workers: try fetch first (may bypass some network restrictions), then Browserless.
  // curl fallback inside crawlWithFetch can bypass Workers fetch limitations.
  if (IS_EDGE_RUNTIME) {
    try {
      return await crawlWithFetch(url);
    } catch (fetchError: any) {
      console.warn('Fetch failed, trying browser:', fetchError.message);
      try {
        return await crawlWithBrowser(url);
      } catch (browserError: any) {
        throw new Error(`Crawl failed: fetch(${fetchError.message}) browser(${browserError.message})`);
      }
    }
  }
  // Locally: try browser first (faster for JS-rendered sites)
  try {
    return await crawlWithBrowser(url);
  } catch (browserError: any) {
    console.warn('Browser crawl failed, falling back to fetch:', browserError.message);
    try {
      return await crawlWithFetch(url);
    } catch (fetchError: any) {
      throw new Error(`Crawl failed: ${fetchError.message}`);
    }
  }
}








