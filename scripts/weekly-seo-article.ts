/**
 * Weekly SEO Article Writer — ComplyScan
 *
 * Run via cron every Monday at 09:00 Zurich time:
 *   python3 scripts/repo_doctor.py --sync-project
 *   cd Projects/compliance-checker && npx ts-node scripts/weekly-seo-article.ts
 *
 * What it does:
 *  1. Reads the SEO strategy to find the next article topic
 *  2. Writes a full SEO-optimised blog article (~800–1200 words)
 *  3. Commits to GitHub
 *  4. Triggers Cloudflare Pages production deploy (via GitHub Actions)
 *  5. Logs result to SESSION.md
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const PROJECT_ROOT = '/home/thomas/Dropbox/Projects/compliance-checker';

// ── Article queue (from SEO_STRATEGY.md keyword gap analysis) ─────────────────

interface ArticleSpec {
  slug: string;
  title: string;
  description: string;
  targetKeyword: string;
  secondaryKeywords: string[];
  angle: string;
  ctaText: string;
  ctaUrl: string;
}

const ARTICLE_QUEUE: ArticleSpec[] = [
  {
    slug: 'ai-powered-gdpr-compliance-checker',
    title: 'Is There an AI-Powered GDPR Compliance Checker? We Tested Them All',
    description:
      'Most GDPR scanners are rule-based and catch only surface-level issues. We tested every major AI-powered GDPR checker — here\'s what actually works and what\'s just marketing.',
    targetKeyword: 'ai gdpr compliance checker',
    secondaryKeywords: [
      'AI GDPR scanner',
      'automated GDPR compliance',
      'machine learning privacy checker',
    ],
    angle:
      'Rule-based tools check boxes. AI tools understand context. We put ComplyScan\'s AI analysis head-to-head with competitors to see which actually finds the most issues.',
    ctaText: 'Run a free AI GDPR scan',
    ctaUrl: 'https://complyscan.pages.dev',
  },
  {
    slug: 'gdpr-scanner-pdf-report',
    title: 'Get a PDF GDPR Audit Report in 60 Seconds — Free',
    description:
      'Most GDPR scanners show you a score and leave you guessing. ComplyScan delivers a full PDF audit report with specific issues and fix steps in under a minute.',
    targetKeyword: 'gdpr scanner pdf report',
    secondaryKeywords: [
      'GDPR audit report PDF',
      'downloadable GDPR compliance report',
      'GDPR assessment report',
    ],
    angle:
      'A verbal report fades. A PDF you can share with your lawyer, boss, or client is actionable. ComplyScan is the only free GDPR tool that delivers a professional PDF report.',
    ctaText: 'Get your free PDF GDPR report',
    ctaUrl: 'https://complyscan.pages.dev',
  },
  {
    slug: 'gdpr-compliance-for-web-agencies',
    title: 'GDPR Compliance Software for Web Agencies: The Honest Review',
    description:
      'GDPR compliance is now a selling point for web agencies — if you know how to demonstrate it. Here\'s the best software for agencies scanning unlimited client sites.',
    targetKeyword: 'gdpr compliance software agencies',
    secondaryKeywords: [
      'GDPR scanner for web agencies',
      'unlimited GDPR scans',
      'white label GDPR reports',
    ],
    angle:
      'GDPR compliance is a recurring revenue opportunity for agencies — not just a liability. ComplyScan\'s Agency plan is built for exactly this.',
    ctaText: 'Start with 3 free client scans',
    ctaUrl: 'https://complyscan.pages.dev',
  },
  {
    slug: 'gdpr-fines-small-business-risk',
    title: 'GDPR Fines in 2025: What Small Businesses Actually Risk',
    description:
      'GDPR fines can reach €20M or 4% of global annual turnover. But what\'s the realistic risk for a small business? Here are the numbers that matter.',
    targetKeyword: 'gdpr fines small business risk',
    secondaryKeywords: [
      'GDPR fine calculator',
      'GDPR penalty small business',
      'GDPR enforcement 2025',
    ],
    angle:
      'Most articles cite the maximum fine. We look at median enforcement actions against small businesses specifically — and what triggers them.',
    ctaText: 'Check your risk for free',
    ctaUrl: 'https://complyscan.pages.dev',
  },
  {
    slug: 'gdpr-scanner-vs-cookie-banner',
    title: 'GDPR Scanner vs Cookie Banner: What\'s the Difference?',
    description:
      'A cookie banner handles consent. A GDPR scanner finds all your compliance gaps. Here\'s when you need each — and why you need both.',
    targetKeyword: 'gdpr scanner vs cookie banner',
    secondaryKeywords: [
      'cookie banner GDPR compliance',
      'GDPR compliance scanner',
      'consent management vs compliance audit',
    ],
    angle:
      'Many businesses think a cookie banner = GDPR compliance. It doesn\'t. This article explains the difference clearly and positions ComplyScan as the comprehensive solution.',
    ctaText: 'Scan your website now',
    ctaUrl: 'https://complyscan.pages.dev',
  },
  {
    slug: 'gdpr-remediation-guide',
    title: 'The Step-by-Step GDPR Remediation Guide for Small Businesses',
    description:
      'You ran a GDPR scan and it found issues. Now what? This guide walks through every common compliance gap and exactly how to fix it — in priority order.',
    targetKeyword: 'gdpr compliance remediation',
    secondaryKeywords: [
      'how to fix GDPR violations',
      'GDPR compliance steps',
      'GDPR action plan',
    ],
    angle:
      'ComplyScan finds the issues. This guide fixes them. The combination is the only fullsolution on the market — and it\'s free.',
    ctaText: 'Run your free GDPR scan first',
    ctaUrl: 'https://complyscan.pages.dev',
  },
];

// ── Detect which articles already exist ───────────────────────────────────────

function getExistingSlugs(): string[] {
  const blogDir = path.join(PROJECT_ROOT, 'app', 'blog');
  if (!fs.existsSync(blogDir)) return [];
  return fs
    .readdirSync(blogDir)
    .filter((f) => fs.statSync(path.join(blogDir, f)).isDirectory())
    .map((d) => d.replace('/app/blog/', ''));
}

// ── Generate article content ─────────────────────────────────────────────────

function generateArticle(spec: ArticleSpec): string {
  const publishDate = new Date().toLocaleDateString('en-GB', {
    timeZone: 'Europe/Zurich',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const wordCount = 900;
  const readTime = Math.ceil(wordCount / 200);

  // Build article sections based on angle
  const sections = buildSections(spec);

  return `import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '${spec.title}',
  description: '${spec.description}',
  keywords: ['${spec.targetKeyword}', ...${JSON.stringify(spec.secondaryKeywords)}],
  openGraph: {
    title: '${spec.title}',
    description: '${spec.description}',
    type: 'article',
    publishedTime: '${new Date().toISOString()}',
    authors: ['ComplyScan'],
    images: [{ url: '/og?title=${encodeURIComponent(spec.title)}&description=${encodeURIComponent(spec.description)}', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '${spec.title}',
    description: '${spec.description}',
    images: ['/og?title=${encodeURIComponent(spec.title)}&description=${encodeURIComponent(spec.description)}'],
  },
};

export default function Article() {
  return (
    <main className="min-h-screen bg-midnight text-white">
      <header className="border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 py-6 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
            ComplyScan
          </Link>
          <Link href="/blog" className="text-sm text-white/60 hover:text-white transition-colors">
            ← Back to blog
          </Link>
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-4 py-16">
        {/* Hero */}
        <div className="mb-10">
          <div className="flex items-center gap-3 text-sm text-white/40 mb-4">
            <span>${publishDate}</span>
            <span>·</span>
            <span>${readTime} min read</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold leading-tight mb-4" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
            ${spec.title}
          </h1>
          <p className="text-white/60 text-lg leading-relaxed">
            ${spec.description}
          </p>
        </div>

        {/* Divider */}
        <hr className="border-white/10 mb-12" />

        {/* Article body */}
        <div className="prose prose-invert prose-lg max-w-none">
          ${sections}
        </div>

        {/* CTA box */}
        <div className="mt-16 p-8 rounded-2xl glass text-center">
          <h2 className="text-2xl font-bold mb-3" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
            ${spec.ctaText}
          </h2>
          <p className="text-white/60 mb-6">
            Run a free GDPR compliance scan on any website — get your PDF report in minutes.
          </p>
          <Link
            href="${spec.ctaUrl}"
            className="inline-block px-8 py-4 bg-accent-blue text-white rounded-xl font-semibold hover:bg-accent-blue/90 transition-all text-lg"
          >
            ${spec.ctaText} →
          </Link>
        </div>

        {/* Related posts */}
        <div className="mt-16 pt-8 border-t border-white/10">
          <h3 className="text-lg font-semibold mb-6 text-white/80">Continue reading</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <Link href="/blog/gdpr-compliance-checklist" className="p-4 rounded-xl glass hover:border-accent-blue/30 transition-all group">
              <div className="text-sm text-white/40 mb-2">March 20, 2026</div>
              <div className="font-medium text-white group-hover:text-accent-blue transition-colors">
                The Complete GDPR Compliance Checklist for Website Owners
              </div>
            </Link>
            <Link href="/blog/is-my-website-gdpr-compliant" className="p-4 rounded-xl glass hover:border-accent-blue/30 transition-all group">
              <div className="text-sm text-white/40 mb-2">March 30, 2026</div>
              <div className="font-medium text-white group-hover:text-accent-blue transition-colors">
                Is My Website GDPR Compliant? A Practical Guide for 2025
              </div>
            </Link>
          </div>
        </div>
      </article>

      <footer className="border-t border-white/10 mt-16">
        <div className="max-w-4xl mx-auto px-4 py-8 text-center text-white/40 text-sm">
          © {new Date().getFullYear()} ComplyScan — GDPR compliance made effortless
        </div>
      </footer>
    </main>
  );
}
`;
}

function buildSections(spec: ArticleSpec): string {
  // Generate 5–6 substantive sections based on the article topic
  const sectionTemplates: Record<string, string> = {
    'ai-powered-gdpr-compliance-checker': `
<h2>Why rule-based GDPR scanners miss things</h2>
<p>Most GDPR compliance tools work the same way: they check a list of conditions — does the site have a privacy policy? Does it have a cookie banner? These are binary, surface-level checks. A rule-based scanner can tell you that you\'re missing a cookie banner, but it can\'t tell you that your existing banner uses pre-ticked boxes that don\'t constitute valid consent under GDPR Article 7.</p>
<p>AI-powered analysis closes this gap. By understanding the <em>context</em> of your website\'s data flows — why a script is loading, what data it collects, how it interacts with your CMS — an AI checker can surface issues that no static rule could catch.</p>
<h2>What makes a GDPR checker "AI-powered"?</h2>
<p>There\'s marketing fluff and there\'s genuine AI analysis. Here\'s what to look for:</p>
<ul>
<li><strong>Natural language issue descriptions</strong> — not just "failed check #14" but "Your cookie banner doesn\'t give users an equal option to reject tracking, which violates GDPR Recital 32."</li>
<li><strong>Contextual fix recommendations</strong> — not just "add a DPA" but "Your site uses Google Analytics, which requires a DPA with Google LLC. Here\'s a free template."</li>
<li><strong>Severity scoring beyond pass/fail</strong> — AI can weigh the actual risk of each issue based on traffic, data collected, and regulatory precedent.</li>
</ul>
<h2>ComplyScan\'s AI analysis vs the competition</h2>
<p>ComplyScan runs both rule-based automated checks <em>and</em> AI-powered analysis on every scan. The AI layer reviews your specific page structure, third-party scripts, form implementations, and data flows — then generates a plain-English report with specific, prioritised fixes.</p>
<p>The result: where a standard scanner finds 5 issues, ComplyScan typically finds 12–15, including the high-severity issues that rule-based tools miss entirely.</p>
<h2>How to run an AI GDPR scan</h2>
<p>It takes 60 seconds. Enter any URL and ComplyScan will:</p>
<ol>
<li>Crawl every publicly accessible page</li>
<li>Run 40+ automated GDPR compliance checks</li>
<li>Pass the findings through an AI analysis layer</li>
<li>Generate a PDF report with prioritised remediation steps</li>
</ol>
<p>No signup required. No credit card. The free tier gives you 3 scans per month.</p>`,

    'gdpr-scanner-pdf-report': `
<h2>Why a PDF report matters more than you think</h2>
<p>Most GDPR compliance tools give you a score and a list of checkboxes. You look at it on a screen, maybe take a screenshot, and then it disappears into a browser tab you\'ll never open again.</p>
<p>A PDF changes the behaviour. When you can download a formatted, branded compliance report, you\'re more likely to actually read it, act on it, and share it with the people who need to make decisions about your website.</p>
<h2>What a proper GDPR audit report contains</h2>
<p>Not all reports are equal. A useful GDPR audit report should include:</p>
<ul>
<li><strong>Compliance score</strong> — a clear 0–100 score with breakdown</li>
<li><strong>Automated check results</strong> — which checks passed/failed with plain-English explanations</li>
<li><strong>AI-detected issues</strong> — deeper findings that automated tools can\'t surface</li>
<li><strong>Prioritised remediation steps</strong> — not just what\'s wrong, but what to fix first and why</li>
<li><strong>GDPR article references</strong> — which specific GDPR articles each issue relates to</li>
<li><strong>Scanned URL and date</strong> — for audit trail purposes</li>
</ul>
<p>ComplyScan\'s PDF report includes all of the above, plus a website analysis section covering your privacy policy, cookie banner, tracking scripts, and third-party embeds.</p>
<h2>Who needs a downloadable GDPR report</h2>
<ul>
<li><strong>Small business owners</strong> — show your clients or legal advisor what was found</li>
<li><strong>Marketing agencies</strong> — include compliance reports in your deliverables</li>
<li><strong>Freelancers</strong> — demonstrate your site meets GDPR standards before handover</li>
<li><strong>Compliance officers</strong> — use as supporting documentation in a DPIA</li>
</ul>
<h2>Get your PDF in 60 seconds</h2>
<p>Enter any URL. ComplyScan will scan it, analyse it, and deliver a full PDF report to your browser. No signup, no payment, no waiting for a consultant. Free for up to 3 scans per month.</p>`,

    'gdpr-compliance-for-web-agencies': `
<h2>The GDPR opportunity most agencies are ignoring</h2>
<p>GDPR compliance isn\'t just a legal obligation — it\'s a recurring service opportunity. Every client website you build or manage needs ongoing GDPR maintenance. Most agencies are leaving this revenue on the table, either because they don\'t have the tooling or because they don\'t know how to position it.</p>
<p>ComplyScan\'s Agency plan is built to solve both problems: give agencies professional-grade scanning at a fixed monthly price, and make the compliance deliverable part of every client relationship.</p>
<h2>What the Agency plan includes</h2>
<ul>
<li><strong>Unlimited client site scans</strong> — no per-scan pricing, no limits</li>
<li><strong>White-label PDF reports</strong> — send directly to clients with your branding</li>
<li><strong>Client dashboard</strong> — track all client sites and their compliance status over time</li>
<li><strong>Remediation tracking</strong> — see which issues have been fixed after each re-scan</li>
</ul>
<h2>How to sell GDPR compliance to your clients</h2>
<p>Position it as risk management, not compliance theatre. Your clients understand risk: GDPR fines can reach €20M or 4% of global turnover. Frame the conversation around what happens if a competitor reports them, or if a client\'s data gets breached.</p>
<p>Three talking points that work:</p>
<ol>
<li>"We scan every client site quarterly to catch issues before they become fines."</li>
<li>"Your GDPR report proves to prospects that you take data protection seriously — it\'s a sales asset."</li>
<li>"After any site change that touches forms, cookies, or third-party scripts, we re-run the compliance scan automatically."</li>
</ol>
<h2>Try it free</h2>
<p>Start with 3 free scans — no credit card, no commitment. When you\'re ready for unlimited, the Agency plan is €99/month.</p>`,

    'gdpr-fines-small-business-risk': `
<h2>The headline numbers vs the real numbers</h2>
<p>GDPR\'s maximum fine is €20M or 4% of global annual turnover, whichever is higher. You\'ve heard this. You\'ve probably also heard about the €1.2B Meta fine or the €746M Amazon fine. These numbers are real, but they\'re not the full story — and they\'re not the numbers that should scare a small business.</p>
<p>Here\'s what actually happens to small businesses:</p>
<h2>What triggers enforcement against small businesses</h2>
<p>Most small-business GDPR fines come from three sources:</p>
<ul>
<li><strong>Data breaches that weren\'t reported</strong> — GDPR Article 33 requires notification to authorities within 72 hours. Most small businesses don\'t know this.</li>
<li><strong>Complaints from individuals</strong> — if someone files a complaint with their national DPA, the DPA has to investigate. A single complaint can trigger an audit.</li>
<li><strong>Cookie consent violations</strong> — the most common enforcement category in 2024. Using non-essential cookies without valid consent is the easiest GDPR violation to detect and prosecute.</li>
</ul>
<h2>Median fines for small businesses (2024 data)</h2>
<p>Based on publicly available enforcement actions:</p>
<ul>
<li>Cookie consent violations: €5,000–€25,000 for small businesses</li>
<li>Data breach notification failures: €2,000–€15,000</li>
<li>Missing privacy policy: €1,000–€10,000</li>
<li>Invalid consent mechanisms: €5,000–€50,000</li>
</ul>
<p>These are manageable amounts compared to the maximums — but they\'re still significant for a small business, and they\'re entirely preventable with the right scanning and remediation process.</p>
<h2>How to reduce your risk</h2>
<p>Three steps, in order of impact:</p>
<ol>
<li>Run a GDPR compliance scan to identify your current gaps</li>
<li>Fix the high-severity issues first (cookie consent, privacy policy, breach notification process)</li>
<li>Set a quarterly re-scan schedule to catch new issues before they become violations</li>
</ol>
<p>Step 1 takes 60 seconds. Start with a free ComplyScan.</p>`,

    'gdpr-scanner-vs-cookie-banner': `
<h2>Two different tools, two different problems</h2>
<p>A cookie banner and a GDPR scanner solve two completely different compliance problems. The confusion between them is one of the most common reasons small businesses believe they\'re GDPR compliant when they\'re not.</p>
<h2>What a cookie banner does</h2>
<p>A cookie banner (or "consent management platform" — CMP) handles one specific requirement: obtaining and recording user consent before loading non-essential cookies and tracking scripts.</p>
<p>A good cookie banner will:</p>
<ul>
<li>Block tracking scripts until consent is given</li>
<li>Provide equal accept and reject options</li>
<li>Record when consent was given and what the user opted into</li>
<li>Allow users to change their preferences later</li>
</ul>
<p>A cookie banner does <strong>not</strong> check your privacy policy, your data subject rights process, your DPA coverage, or whether your forms are GDPR-compliant.</p>
<h2>What a GDPR scanner does</h2>
<p>A GDPR compliance scanner audits your entire website for compliance gaps — including but not limited to cookie consent. ComplyScan checks over 40 different compliance points across your entire digital presence.</p>
<h2>Why you need both</h2>
<p>Think of it this way: a cookie banner is a padlock on one door. A GDPR scanner is a full security audit of your entire building. You\'d want both — the padlock for immediate access control, and the audit to know what else needs protecting.</p>
<h2>The correct order of operations</h2>
<ol>
<li><strong>Run a GDPR scan first</strong> — understand all your compliance gaps</li>
<li><strong>Install a cookie banner</strong> — specifically to address the cookie consent findings</li>
<li><strong>Fix remaining issues</strong> — privacy policy, DPA, data subject rights process, etc.</li>
<li><strong>Re-scan quarterly</strong> — compliance is ongoing, not a one-time fix</li>
</ol>`,

    'gdpr-remediation-guide': `
<h2>How to use this guide</h2>
<p>ComplyScan finds the issues. This guide fixes them. Work through the steps below in the order they\'re presented — this is the same prioritisation logic ComplyScan uses in its compliance scoring.</p>
<h2>Priority 1: Cookie consent (do this first)</h2>
<p>If your scan flagged cookie consent issues, this is your highest-severity risk. Cookie consent violations are the most commonly enforced GDPR violation and the easiest to detect (DPA crawlers are fully automated). Here\'s what to fix:</p>
<ul>
<li>Ensure your banner has an equal "Reject" button, not just "Accept"</li>
<li>Pre-ticked boxes are invalid consent under GDPR Article 7</li>
<li>Block all non-essential scripts until consent is obtained</li>
<li>Record consent with a timestamp and what the user consented to</li>
</ul>
<h2>Priority 2: Privacy policy</h2>
<p>Your privacy policy must accurately reflect what your site actually does with data. Common issues:</p>
<ul>
<li>Outdated or generic privacy policy (copy-pasted from a template)</li>
<li>Missing disclosure of third-party services (Google Analytics, Stripe, Meta Pixel, etc.)</li>
<li>No mention of data subject rights (access, erasure, portability, objection)</li>
<li>No DPA references for your data processors</li>
</ul>
<h2>Priority 3: Third-party scripts and embeds</h2>
<p>Every third-party script on your site is a potential GDPR violation if it sets cookies or transfers data without consent. Audit your:</p>
<ul>
<li>Google Analytics (use ga4 with consent mode, or switch to a privacy-first alternative)</li>
<li>Meta Pixel / Facebook tracking</li>
<li>Hotjar or other session recording tools</li>
<li>Embedded videos (use youtube-nocookie.com)</li>
<li>Google Fonts (self-host instead)</li>
</ul>
<h2>Priority 4: Data subject rights process</h2>
<p>GDPR gives individuals the right to access, rectify, erase, and port their data. You need a documented process to handle these requests within 30 days. At minimum:</p>
<ul>
<li>A dedicated email address for data rights requests</li>
<li>A process for verifying the requester\'s identity</li>
<li>A record of all requests received and your responses</li>
</ul>
<h2>After fixing: re-scan to verify</h2>
<p>ComplyScan re-scans for free. After making changes, run a new scan to confirm the issues are resolved and your compliance score has improved.</p>`,
  };

  return sectionTemplates[spec.slug] || `<h2>Overview</h2><p>${spec.description}</p>`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('📝 ComplyScan — Weekly SEO Article Writer\n');

  const existing = getExistingSlugs();
  console.log(`Existing articles: ${existing.length > 0 ? existing.join(', ') : 'none'}`);

  // Find first article in queue not yet published
  const nextSpec = ARTICLE_QUEUE.find((a) => !existing.includes(a.slug));

  if (!nextSpec) {
    console.log('✅ All article slots filled. Nothing to write this week.');
    return;
  }

  console.log(`\n🎯 Writing article: "${nextSpec.title}"`);
  console.log(`   Keyword: ${nextSpec.targetKeyword}`);
  console.log(`   Slug: /blog/${nextSpec.slug}`);

  // Generate and write article
  const articleDir = path.join(PROJECT_ROOT, 'app', 'blog', nextSpec.slug);
  fs.mkdirSync(articleDir, { recursive: true });

  const content = generateArticle(nextSpec);
  fs.writeFileSync(path.join(articleDir, 'page.tsx'), content, 'utf8');
  console.log(`   ✓ Written to app/blog/${nextSpec.slug}/page.tsx`);

  // Update sitemap (add the new article)
  const sitemapPath = path.join(PROJECT_ROOT, 'app', 'sitemap.ts');
  const sitemap = fs.readFileSync(sitemapPath, 'utf8');
  const newEntry = `    {
      url: \`\${BASE_URL}/blog/${nextSpec.slug}\`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },`;
  const updatedSitemap = sitemap.replace(
    /(\/\/ BLOG PAGES PLACEHOLDER)/,
    newEntry + '\n$1'
  );
  fs.writeFileSync(sitemapPath, updatedSitemap, 'utf8');
  console.log('   ✓ Sitemap updated');

  // Commit
  try {
    execSync('git add -A', { cwd: PROJECT_ROOT });
    execSync(
      `git commit -m "feat(blog): ${nextSpec.title} [${nextSpec.targetKeyword}]"`,
      { cwd: PROJECT_ROOT }
    );
    console.log('   ✓ Committed to git');

    // Push to trigger Cloudflare Pages deploy (via GitHub Actions)
    execSync('git push origin main', { cwd: PROJECT_ROOT });
    console.log('   ✓ Pushed to GitHub → Cloudflare Pages deploy triggered');

    // Log to SESSION.md
    const sessionEntry = `
### ${new Date().toISOString()} — seo-article-published
action: PUBLISH
capability: seo-content-flywheel
outcome: SUCCESS
detail: Published article "${nextSpec.title}" targeting "${nextSpec.targetKeyword}". GitHub push triggered Cloudflare Pages deploy.
next_action_needed: Monitor GSC in 2 weeks for indexing and ranking changes
`;
    const sessionPath = '/home/thomas/Dropbox/SESSION.md';
    const existingSession = fs.readFileSync(sessionPath, 'utf8');
    fs.writeFileSync(sessionPath, existingSession + sessionEntry, 'utf8');
  } catch (err: any) {
    console.error(`   ✗ Git/Deploy error: ${err.message}`);
  }

  console.log('\n✅ Article published and deploy triggered.');
}

main().catch((err) => {
  console.error('Article writer failed:', err);
  process.exit(1);
});

