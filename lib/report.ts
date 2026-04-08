import type { CrawlResult } from './crawler';
import { isNormalizedScanResultV2, normalizeScanResultV2, type NormalizedScanResultV2 } from './scan-normalize';

export interface RuleCheck {
  id: string;
  name: string;
  passed: boolean;
  detail: string;
  recommendation?: string;
  gdprArticle?: string;
}

export interface AIIssue {
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  fix?: string;
  evidence?: string;
  gdprArticle?: string;
}

export interface AIAnalysis {
  gdprScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  summary: string;
  issues: AIIssue[];
}

export interface ScanResult {
  crawl: CrawlResult;
  ruleChecks: RuleCheck[];
  aiAnalysis: AIAnalysis;
  scannedAt: string;
}

export type Branding = {
  agencyName?: string | null;
  logoUrl?: string | null;
  logoDataUrl?: string | null;
};

const ACCENT = '#2563eb';
const SUCCESS = '#16a34a';
const SUCCESS_BG = '#f0fdf4';
const WARN = '#d97706';
const WARN_BG = '#fffbeb';
const FAIL = '#dc2626';
const FAIL_BG = '#fef2f2';
const INFO_BG = '#eff6ff';
const TEXT = '#1e293b';
const TEXT_MUTED = '#64748b';
const BORDER = '#e2e8f0';
const WHITE = '#ffffff';

function esc(text: string | undefined | null): string {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function severityColor(s: string): string {
  if (s === 'critical') return FAIL;
  if (s === 'warning') return WARN;
  return ACCENT;
}

function severityBg(s: string): string {
  if (s === 'critical') return FAIL_BG;
  if (s === 'warning') return WARN_BG;
  return INFO_BG;
}

function scoreColor(score: number): string {
  if (score >= 75) return SUCCESS;
  if (score >= 50) return WARN;
  return FAIL;
}

function riskLabel(risk: string): string {
  const map: Record<string, string> = {
    low: 'LOW RISK',
    medium: 'MEDIUM RISK',
    high: 'HIGH RISK',
    critical: 'CRITICAL RISK',
  };
  return map[risk] || risk.toUpperCase();
}

function gdprArticleLabel(article: string | undefined): string {
  if (!article) return '';
  const labels: Record<string, string> = {
    '5': 'Art. 5 — Principles of processing',
    '6': 'Art. 6 — Lawfulness of processing',
    '7': 'Art. 7 — Conditions for consent',
    '12': 'Art. 12 — Transparent information',
    '13': 'Art. 13 — Information provision',
    '14': 'Art. 14 — Information to be provided',
    '15': 'Art. 15 — Right of access',
    '16': 'Art. 16 — Right to rectification',
    '17': 'Art. 17 — Right to erasure',
    '18': 'Art. 18 — Restriction of processing',
    '20': 'Art. 20 — Right to data portability',
    '21': 'Art. 21 — Objection to processing',
    '22': 'Art. 22 — Automated decision-making',
    '25': 'Art. 25 — Data protection by design',
    '26': 'Art. 26 — Joint controllers',
    '27': 'Art. 27 — Representatives of controllers',
    '28': 'Art. 28 — Processor obligations',
    '30': 'Art. 30 — Records of processing',
    '32': 'Art. 32 — Security of processing',
    '33': 'Art. 33 — Notification of breaches',
    '35': 'Art. 35 — DPIA',
    '44': 'Art. 44 — General principle',
    '46': 'Art. 46 — Transfer mechanisms',
    '47': 'Art. 47 — Binding corporate rules',
    '49': 'Art. 49 — Derogations',
    '13/26': 'Art. 13/26 — Data processor disclosure',
  };
  return labels[article] || `Art. ${article}`;
}

function checklistItem(text: string, status: 'done' | 'todo'): string {
  const mark = status === 'done' ? '☑' : '☐';
  const color = status === 'done' ? SUCCESS : TEXT_MUTED;
  return `<div style="margin:4px 0;color:${color};">${mark} ${text}</div>`;
}

function card(children: string, bg = WHITE, border = BORDER): string {
  return `<div style="background:${bg};border:1px solid ${border};border-radius:12px;padding:20px;margin-bottom:20px;">${children}</div>`;
}

function sectionTitle(text: string): string {
  return `<div style="margin:36px 0 16px;">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">
      <div style="width:4px;height:20px;background:${ACCENT};border-radius:2px;"></div>
      <h2 style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:18px;font-weight:700;color:${TEXT};margin:0;">${text}</h2>
    </div>
  </div>`;
}

function h3(text: string): string {
  return `<h3 style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;font-weight:600;color:${TEXT};margin:16px 0 8px;">${text}</h3>`;
}

function p(text: string): string {
  return `<p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;color:${TEXT_MUTED};line-height:1.6;margin:0 0 12px;">${text}</p>`;
}

function scoreBarHtml(score: number): string {
  const color = scoreColor(score);
  const bars = Math.round(score / 10);
  let html = `<div style="margin:16px 0;">`;
  for (let i = 1; i <= 10; i++) {
    const filled = i <= bars;
    html += `<div style="display:inline-block;width:9%;height:24px;background:${filled ? color : BORDER};border-radius:3px;margin-right:1%;"></div>`;
  }
  html += `</div>`;
  return html;
}

function pageBreak(): string {
  return `<div class="page-break"></div>`;
}

function coerceToReportInput(url: string, result: any): {
  crawl: CrawlResult;
  ruleChecks: any[];
  aiAnalysis: any;
  scannedAt: string;
  normalized: NormalizedScanResultV2;
} {
  if (isNormalizedScanResultV2(result)) {
    return {
      crawl: result.raw.crawl,
      ruleChecks: result.raw.ruleChecks || [],
      aiAnalysis: result.raw.aiAnalysis || {},
      scannedAt: result.scannedAt,
      normalized: result,
    };
  }

  const crawl = result?.crawl as CrawlResult;
  const ruleChecks = (result?.ruleChecks || []) as any[];
  const aiAnalysis = result?.aiAnalysis || {};
  const scannedAt = String(result?.scannedAt || new Date().toISOString());
  const normalized = normalizeScanResultV2({ url, crawl, ruleChecks, aiAnalysis, scannedAt });
  return { crawl, ruleChecks, aiAnalysis, scannedAt, normalized };
}

export function generateReportHtml(url: string, result: ScanResult | NormalizedScanResultV2, fullReport = true, branding?: Branding): string {
  const { crawl, ruleChecks, aiAnalysis, scannedAt, normalized } = coerceToReportInput(url, result);
  const score = normalized.score ?? 0;
  const scoreColorVal = scoreColor(score);
  const risk = normalized.risk ?? 'medium';
  const passCount = ruleChecks.filter(c => c.passed).length;
  const failCount = ruleChecks.filter(c => !c.passed).length;

  const allIssues = normalized.issues ?? [];
  const displayedIssues = fullReport ? allIssues : allIssues.slice(0, 3);
  const hiddenIssueCount = allIssues.length - displayedIssues.length;
  const issueCount = displayedIssues.length;

  const allFailedChecks = ruleChecks.filter(c => !c.passed);
  const displayedFailedChecks = fullReport ? allFailedChecks : allFailedChecks.slice(0, 3);
  const hiddenFailedCount = allFailedChecks.length - displayedFailedChecks.length;
  const passedChecks = ruleChecks.filter(c => c.passed);
  const criticalIssues = displayedIssues.filter(i => i.severity === 'critical');

  const scanDate = new Date(scannedAt).toLocaleDateString('en-GB', {
    timeZone: 'Europe/Zurich',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const previewBanner = !fullReport ? `
      <div style="background:#f59e0b;color:#1e293b;padding:10px 24px;border-radius:8px;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:32px;">
        FREE PREVIEW — Upgrade to view full report
      </div>` : '';

  const coverPage = `
  <div style="page-break-after:always;">
  <div style="display:flex;flex-direction:column;justify-content:center;align-items:center;height:100vh;background:linear-gradient(135deg,#1e3a5f 0%,#2563eb 100%);color:${WHITE};text-align:center;padding:60px;">
      ${previewBanner}
      <div style="font-size:42px;font-weight:800;letter-spacing:-1px;margin-bottom:8px;">ComplyScan</div>
      <div style="font-size:14px;opacity:0.7;letter-spacing:2px;text-transform:uppercase;margin-bottom:60px;">GDPR Compliance Report</div>

      <div style="font-size:80px;font-weight:800;line-height:1;color:${scoreColorVal};">${score}</div>
      <div style="font-size:14px;opacity:0.8;margin-bottom:8px;">out of 100 — Compliance Score</div>
      <div style="display:inline-block;background:${scoreColorVal};color:${WHITE};padding:6px 20px;border-radius:20px;font-size:12px;font-weight:700;letter-spacing:1px;margin-top:12px;margin-bottom:60px;">
        ${riskLabel(risk)}
      </div>

      <div style="background:rgba(255,255,255,0.1);border-radius:12px;padding:24px 40px;width:100%;max-width:600px;margin-bottom:40px;">
        <div style="font-size:11px;opacity:0.6;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Scanned Website</div>
        <div style="font-size:16px;font-weight:600;">${url ? esc(url) : '<span style="opacity:0.4;">Not available</span>'}</div>
      </div>

      <div style="display:flex;gap:40px;font-size:13px;opacity:0.7;">
        <div><div style="font-size:11px;opacity:0.6;margin-bottom:4px;">DATE</div>${scanDate}</div>
        <div><div style="font-size:11px;opacity:0.6;margin-bottom:4px;">AUTOMATED CHECKS</div>${passCount} passed / ${failCount} failed</div>
        <div><div style="font-size:11px;opacity:0.6;margin-bottom:4px;">AI DETECTED ISSUES</div>${issueCount} findings</div>
      </div>
  </div>
  </div>`;

  const execSummaryPreviewNote = !fullReport ? `<div style="background:#fffbeb;border:1px solid #f59e0b;border-radius:8px;padding:12px 16px;margin-bottom:16px;font-size:13px;color:#92400e;">
      <strong>Free Preview:</strong> This report shows ${displayedFailedChecks.length} of ${allFailedChecks.length} failed checks and ${displayedIssues.length} of ${allIssues.length} AI findings. Upgrade to access the full compliance analysis with all findings and detailed remediation steps.
    </div>` : '';
  const execSummary = card(`
    ${h3('Executive Summary')}
    ${p(`This automated GDPR compliance scan was conducted on <strong>${esc(url)}</strong> on ${scanDate}. The scan uses a combination of rule-based automated checks and AI-powered analysis to identify potential GDPR compliance gaps.`)}
    ${p(`The overall compliance score is <strong style="color:${scoreColorVal}">${score}/100</strong>, classified as <strong>${riskLabel(risk)}</strong>.`)}
    ${p(`The automated rule engine performed ${ruleChecks.length} checks, of which <strong style="color:${SUCCESS}">${passCount} passed</strong> and <strong style="color:${FAIL}">${failCount} failed</strong>. The AI analysis identified <strong>${issueCount} additional findings</strong>${criticalIssues.length > 0 ? `, including <strong>${criticalIssues.length} critical</strong>` : ''}.`)}
    ${aiAnalysis?.summary ? p(`<strong>AI Assessment:</strong> ${esc(aiAnalysis.summary)}`) : ''}
    ${execSummaryPreviewNote}
  `);

  const tocItems = [
    'Executive Summary',
    'Score Breakdown',
    'Key Findings',
    'Automated Checks',
    ...(allIssues.length > 0 ? ['AI-Detected Issues'] : []),
    'Privacy Policy Analysis',
    'GDPR Articles Quick Reference',
    'Remediation Action Plan',
    'Methodology and Limitations',
    'Technical Appendix',
    'Glossary',
  ];

  const tocPage = fullReport
    ? card(`
      ${h3('Table of Contents')}
      <div style="font-size:13px;color:${TEXT_MUTED};line-height:1.9;">
        ${tocItems.map((t, idx) => `<div>${idx + 1}. ${esc(t)}</div>`).join('')}
      </div>
    `, INFO_BG, ACCENT)
    : '';

  const topFailedChecks = allFailedChecks.slice(0, 5);
  const topIssues = allIssues.slice(0, 5);

  const keyFindingsPage = fullReport
    ? sectionTitle('Key Findings') +
      card(`
        ${p('This section highlights the most actionable findings from the scan. Review the detailed sections that follow for full context.')}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          <div>
            ${h3(`Top Failed Checks (${allFailedChecks.length})`)}
            ${topFailedChecks.length
              ? topFailedChecks.map((c) => `<div style="padding:10px 12px;border:1px solid ${BORDER};border-radius:10px;margin-bottom:10px;background:${FAIL_BG};">
                  <div style="font-size:13px;font-weight:700;color:${TEXT};margin-bottom:4px;">${esc(c.name)}</div>
                  <div style="font-size:12px;color:${TEXT_MUTED};line-height:1.5;">${esc(c.detail || '')}</div>
                  ${c.recommendation ? `<div style="margin-top:8px;font-size:12px;color:#854d0e;"><strong>Fix:</strong> ${esc(c.recommendation)}</div>` : ''}
                </div>`).join('')
              : `<div style="font-size:13px;color:${SUCCESS};">No failed checks detected.</div>`}
          </div>
          <div>
            ${h3(`Top AI Findings (${allIssues.length})`)}
            ${topIssues.length
              ? topIssues.map((i) => `<div style="padding:10px 12px;border:1px solid ${BORDER};border-radius:10px;margin-bottom:10px;background:${severityBg(i.severity)};">
                  <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
                    <div style="font-size:13px;font-weight:700;color:${TEXT};">${esc(i.title)}</div>
                    <div style="font-size:10px;font-weight:800;letter-spacing:1px;color:${severityColor(i.severity)};">${i.severity.toUpperCase()}</div>
                  </div>
                  <div style="font-size:12px;color:${TEXT_MUTED};line-height:1.5;margin-top:4px;">${esc((i as any).impact || (i as any).description)}</div>
                  ${i.fix ? `<div style="margin-top:8px;font-size:12px;color:#166534;"><strong>Fix:</strong> ${esc(i.fix)}</div>` : ''}
                </div>`).join('')
              : `<div style="font-size:13px;color:${SUCCESS};">No AI findings detected.</div>`}
          </div>
        </div>
      `, WHITE, BORDER)
    : '';

  const scoreBreakdown = card(`
    ${h3('Compliance Score Breakdown')}
    ${scoreBarHtml(score)}
    <div style="display:flex;justify-content:space-between;font-size:12px;color:${TEXT_MUTED};margin-bottom:16px;">
      <span>0 — Critical Non-Compliance</span>
      <span>50 — Partial Compliance</span>
      <span>100 — Full Compliance</span>
    </div>
    ${score >= 75 ? p('<svg width="16" height="16" viewBox="0 0 24 24" style="vertical-align:middle;margin-right:4px"><circle cx="12" cy="12" r="11" fill="#16a34a"/><path d="M7 12.5l3.5 3.5 6.5-7" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg> <strong>Good standing.</strong> Your website demonstrates reasonable GDPR compliance. Address the flagged items to reach full compliance.') : ''}
    ${score >= 50 && score < 75 ? p('<svg width="16" height="16" viewBox="0 0 24 24" style="vertical-align:middle;margin-right:4px"><circle cx="12" cy="12" r="11" fill="#d97706"/><path d="M12 8v5M12 16v.01" stroke="white" stroke-width="2.5" stroke-linecap="round"/></svg> <strong>Partial compliance.</strong> Several issues require attention. Prioritise the critical and high-severity findings below.') : ''}
    ${score < 50 ? p('<svg width="16" height="16" viewBox="0 0 24 24" style="vertical-align:middle;margin-right:4px"><circle cx="12" cy="12" r="11" fill="#dc2626"/><path d="M12 8v5M12 16v.01" stroke="white" stroke-width="2.5" stroke-linecap="round"/></svg> <strong>Significant compliance gaps.</strong> Immediate action is recommended. Critical issues are likely exposing your business to regulatory risk.') : ''}
  `);

  const checksUpgradeNote = !fullReport && hiddenFailedCount > 0 ? `
    <div style="background:#eff6ff;border:1px solid ${ACCENT};border-radius:8px;padding:14px 16px;margin:16px 0;font-size:13px;color:${ACCENT};text-align:center;">
      <strong>Upgrade to see all ${allFailedChecks.length} failed checks</strong> with full recommendations and GDPR article references.
    </div>` : '';

  const passedChecksSection = fullReport ? passedChecks.map(check => card(`
      <div style="display:flex;align-items:flex-start;gap:12px;">
        <div style="width:32px;height:32px;border-radius:50%;background:${SUCCESS_BG};border:2px solid ${SUCCESS};display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;"><svg width="16" height="16" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#16a34a"/><path d="M7 12.5l3.5 3.5 6.5-7" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg></div>
        <div style="flex:1;">
          <div style="font-size:14px;font-weight:600;color:${TEXT};margin-bottom:4px;">${esc(check.name)}</div>
          <div style="font-size:13px;color:${TEXT_MUTED};">${esc(check.detail || 'Passed')}</div>
          ${check.gdprArticle ? `<div style="font-size:11px;color:${ACCENT};margin-top:8px;"><svg width="11" height="11" viewBox="0 0 24 24" style="vertical-align:middle;margin-right:3px"><rect x="3" y="3" width="18" height="18" rx="2" fill="#2563eb"/><path d="M8 12h8M8 8h8M8 16h4" stroke="white" stroke-width="2" stroke-linecap="round"/></svg>${gdprArticleLabel(check.gdprArticle)}</div>` : ''}
        </div>
      </div>
    `, SUCCESS_BG, SUCCESS)).join('') : `<div style="font-size:13px;color:${TEXT_MUTED};padding:8px 0;">${passedChecks.length} checks passed — <strong>upgrade to see details</strong>.</div>`;

  const checksSection = sectionTitle(`Automated Checks (<svg width="14" height="14" viewBox="0 0 24 24" style="vertical-align:middle"><circle cx="12" cy="12" r="11" fill="#16a34a"/><path d="M7 12.5l3.5 3.5 6.5-7" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg> ${passCount} / <svg width="14" height="14" viewBox="0 0 24 24" style="vertical-align:middle"><circle cx="12" cy="12" r="11" fill="#dc2626"/><path d="M8 8l8 8M16 8l-8 8" stroke="white" stroke-width="2.5" stroke-linecap="round" fill="none"/></svg> ${failCount})`) +
    checksUpgradeNote +
    displayedFailedChecks.map(check => card(`
      <div style="display:flex;align-items:flex-start;gap:12px;">
        <div style="width:32px;height:32px;border-radius:50%;background:${FAIL_BG};border:2px solid ${FAIL};display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;"><svg width="16" height="16" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#dc2626"/><path d="M8 8l8 8M16 8l-8 8" stroke="white" stroke-width="2.5" stroke-linecap="round" fill="none"/></svg></div>
        <div style="flex:1;">
          <div style="font-size:14px;font-weight:600;color:${TEXT};margin-bottom:4px;">${esc(check.name)}</div>
          <div style="font-size:13px;color:${TEXT_MUTED};margin-bottom:${check.recommendation ? '8px' : '0'};">${esc(check.detail || '')}</div>
          ${check.recommendation ? `<div style="background:#fef9c3;border-left:3px solid ${WARN};padding:8px 12px;border-radius:0 6px 6px 0;font-size:12px;color:#854d0e;"><strong>Recommendation:</strong> ${esc(check.recommendation)}</div>` : ''}
          ${check.gdprArticle ? `<div style="font-size:11px;color:${ACCENT};margin-top:8px;"><svg width="11" height="11" viewBox="0 0 24 24" style="vertical-align:middle;margin-right:3px"><rect x="3" y="3" width="18" height="18" rx="2" fill="#2563eb"/><path d="M8 12h8M8 8h8M8 16h4" stroke="white" stroke-width="2" stroke-linecap="round"/></svg>${gdprArticleLabel(check.gdprArticle)}</div>` : ''}
        </div>
      </div>
    `, FAIL_BG, FAIL)).join('') +
    (hiddenFailedCount > 0 ? `<div style="text-align:center;margin-top:8px;font-size:13px;color:${TEXT_MUTED};">+ ${hiddenFailedCount} more failed checks in full report</div>` : '') +
    passedChecksSection;

  const aiUpgradeNote = !fullReport && hiddenIssueCount > 0 ? `
    <div style="background:#eff6ff;border:1px solid ${ACCENT};border-radius:8px;padding:14px 16px;margin:16px 0;font-size:13px;color:${ACCENT};text-align:center;">
      <strong>Upgrade to access all ${allIssues.length} AI findings</strong> including critical and warning severity items with full evidence and fix recommendations.
    </div>` : '';

  const aiIssuesSection = displayedIssues.length
    ? sectionTitle(`Issues (${displayedIssues.length} of ${allIssues.length} Shown)`) +
      aiUpgradeNote +
      displayedIssues.map((issue: any) => card(`
        <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:8px;">
          <div style="width:32px;height:32px;border-radius:50%;background:${severityBg(issue.severity)};border:2px solid ${severityColor(issue.severity)};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:${severityColor(issue.severity)};flex-shrink:0;">${issue.severity === 'critical' ? 'CRIT' : issue.severity === 'warning' ? 'WARN' : 'INFO'}</div>
          <div style="flex:1;">
            <div style="font-size:14px;font-weight:600;color:${TEXT};margin-bottom:6px;">${esc(issue.title)}</div>
            <div style="font-size:13px;color:${TEXT_MUTED};margin-bottom:${issue.fix || issue.gdprArticle ? '10px' : '0'};line-height:1.5;">${esc(issue.impact || issue.description)}</div>
            ${issue.evidence ? `<div style="background:#f8fafc;border-radius:6px;padding:8px 10px;font-size:12px;color:#475569;font-family:monospace;margin-bottom:10px;word-break:break-all;">Evidence: ${esc(typeof issue.evidence === 'string' ? issue.evidence : JSON.stringify(issue.evidence).slice(0, 800))}</div>` : ''}
            ${issue.fix ? `<div style="background:#f0fdf4;border-left:3px solid ${SUCCESS};padding:10px 12px;border-radius:0 6px 6px 0;font-size:13px;color:#166534;"><strong><svg width="12" height="12" viewBox="0 0 24 24" style="vertical-align:middle;margin-right:3px"><circle cx="12" cy="12" r="11" fill="#16a34a"/><path d="M7 12.5l3.5 3.5 6.5-7" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>Recommended Fix:</strong><br>${esc(issue.fix)}</div>` : ''}
            ${issue.gdprArticle ? `<div style="font-size:11px;color:${ACCENT};margin-top:8px;"><svg width="11" height="11" viewBox="0 0 24 24" style="vertical-align:middle;margin-right:3px"><rect x="3" y="3" width="18" height="18" rx="2" fill="#2563eb"/><path d="M8 12h8M8 8h8M8 16h4" stroke="white" stroke-width="2" stroke-linecap="round"/></svg>${gdprArticleLabel(issue.gdprArticle)}</div>` : ''}
          </div>
        </div>
      `, severityBg(issue.severity), severityColor(issue.severity))).join('')
    : '';

  const policySection = sectionTitle('Privacy Policy Analysis') +
    card(`
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div>
          ${h3('Website Information')}
          <div style="font-size:13px;color:${TEXT_MUTED};line-height:1.8;">
            ${crawl.title ? `<div><strong>Title:</strong> ${esc(crawl.title)}</div>` : ''}
            <div><strong>URL:</strong> ${url ? esc(url) : '<span style="opacity:0.4;">Not available</span>'}</div>
            <div><strong>HTTPS:</strong> <span style="color:${crawl.hasSSL ? SUCCESS : FAIL};">${crawl.hasSSL ? '<svg width="12" height="12" viewBox="0 0 24 24" style="vertical-align:middle"><circle cx="12" cy="12" r="11" fill="#16a34a"/><path d="M7 12.5l3.5 3.5 6.5-7" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg> Enabled' : '<svg width="12" height="12" viewBox="0 0 24 24" style="vertical-align:middle"><circle cx="12" cy="12" r="11" fill="#dc2626"/><path d="M8 8l8 8M16 8l-8 8" stroke="white" stroke-width="2.5" stroke-linecap="round" fill="none"/></svg> Not enabled'}</span></div>
            <div><strong>Status:</strong> ${crawl.statusCode || 'Unknown'}</div>
            <div><strong>Forms found:</strong> ${crawl.formsCount}</div>
            <div><strong>Labeled form inputs:</strong> ${crawl.formInputsLabeled} / ${crawl.totalFormInputs}</div>
          </div>
        </div>
        <div>
          ${h3('Policy Presence')}
          <div style="font-size:13px;color:${TEXT_MUTED};line-height:1.8;">
            <div><strong>Privacy Policy:</strong> <span style="color:${crawl.hasPrivacyPolicy ? SUCCESS : FAIL};">${crawl.hasPrivacyPolicy ? '<svg width="12" height="12" viewBox="0 0 24 24" style="vertical-align:middle"><circle cx="12" cy="12" r="11" fill="#16a34a"/><path d="M7 12.5l3.5 3.5 6.5-7" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg> Found' : '<svg width="12" height="12" viewBox="0 0 24 24" style="vertical-align:middle"><circle cx="12" cy="12" r="11" fill="#dc2626"/><path d="M8 8l8 8M16 8l-8 8" stroke="white" stroke-width="2.5" stroke-linecap="round" fill="none"/></svg> Missing'}</span></div>
            ${crawl.privacyPolicyUrl ? `<div style="word-break:break-all;font-size:12px;"><strong>Policy URL:</strong> ${esc(crawl.privacyPolicyUrl)}</div>` : ''}
            <div><strong>Cookie Policy:</strong> <span style="color:${crawl.hasCookiePolicyPage ? SUCCESS : WARN};">${crawl.hasCookiePolicyPage ? '<svg width="12" height="12" viewBox="0 0 24 24" style="vertical-align:middle"><circle cx="12" cy="12" r="11" fill="#16a34a"/><path d="M7 12.5l3.5 3.5 6.5-7" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg> Found' : '<svg width="12" height="12" viewBox="0 0 24 24" style="vertical-align:middle"><circle cx="12" cy="12" r="11" fill="#d97706"/><path d="M12 8v5M12 16v.01" stroke="white" stroke-width="2.5" stroke-linecap="round"/></svg> Not detected'}</span></div>
            <div><strong>Cookie Banner:</strong> <span style="color:${crawl.hasCookieBanner ? SUCCESS : WARN};">${crawl.hasCookieBanner ? '<svg width="12" height="12" viewBox="0 0 24 24" style="vertical-align:middle"><circle cx="12" cy="12" r="11" fill="#16a34a"/><path d="M7 12.5l3.5 3.5 6.5-7" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg> Detected' : '<svg width="12" height="12" viewBox="0 0 24 24" style="vertical-align:middle"><circle cx="12" cy="12" r="11" fill="#d97706"/><path d="M12 8v5M12 16v.01" stroke="white" stroke-width="2.5" stroke-linecap="round"/></svg> Not detected'}</span></div>
            ${crawl.cookieBannerText ? `<div style="font-size:12px;word-break:break-all;"><strong>Banner text:</strong> ${esc(crawl.cookieBannerText.slice(0, 100))}</div>` : ''}
          </div>
        </div>
      </div>
    `) +
    card(`
      ${h3('Tracking Scripts Detected')}
      ${crawl.trackingScripts?.length
        ? `<div style="display:flex;flex-wrap:wrap;gap:6px;">${crawl.trackingScripts.map((s: string) => `<span style="background:${INFO_BG};border:1px solid ${ACCENT};color:${ACCENT};padding:3px 10px;border-radius:20px;font-size:11px;font-weight:500;">${esc(s)}</span>`).join('')}</div>`
        : `<div style="color:${SUCCESS};font-size:13px;"><svg width="12" height="12" viewBox="0 0 24 24" style="vertical-align:middle;margin-right:4px"><circle cx="12" cy="12" r="11" fill="#16a34a"/><path d="M7 12.5l3.5 3.5 6.5-7" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>No third-party tracking scripts detected.</div>`
      }
      ${crawl.thirdPartyEmbeds?.length ? `<div style="margin-top:12px;"><strong>Third-party embeds:</strong> ${crawl.thirdPartyEmbeds.map((e: string) => `<span style="background:${WARN_BG};color:${WARN};padding:2px 8px;border-radius:12px;font-size:11px;margin-right:4px;">${esc(e)}</span>`).join('')}</div>` : ''}
    `);

  const gdprRef = sectionTitle('GDPR Articles Quick Reference') +
    card(`
      <p style="margin:0 0 16px;font-size:13px;color:${TEXT_MUTED};">Key GDPR articles relevant to the findings above:</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;">
        ${[
          ['Art. 5', 'Principles of processing'],
          ['Art. 6', 'Lawfulness of processing'],
          ['Art. 7', 'Conditions for consent'],
          ['Art. 12', 'Transparent information'],
          ['Art. 13/14', 'Information provision'],
          ['Art. 15', 'Right of access'],
          ['Art. 17', 'Right to erasure'],
          ['Art. 20', 'Right to data portability'],
          ['Art. 25', 'Data protection by design'],
          ['Art. 32', 'Security of processing'],
          ['Art. 35', 'Data Protection Impact Assessment'],
          ['Art. 46', 'Transfer mechanisms'],
        ].map(([art, desc]) => `
          <div style="display:flex;gap:8px;align-items:flex-start;padding:6px 0;border-bottom:1px solid ${BORDER};">
            <span style="font-weight:700;color:${ACCENT};min-width:52px;">${art}</span>
            <span style="color:${TEXT_MUTED};">${desc}</span>
          </div>
        `).join('')}
      </div>
    `, INFO_BG);

  const methodologySection = fullReport
    ? sectionTitle('Methodology and Limitations') +
      card(`
        ${p('This report is generated from an automated scan. It combines (1) deterministic rule checks and (2) AI-assisted analysis based on observed content and detected signals.')}
        ${h3('What We Check')}
        <div style="font-size:13px;color:${TEXT_MUTED};line-height:1.8;">
          <div><strong>Technical signals:</strong> HTTPS, forms, tracking scripts, embeds, cookie banner indicators.</div>
          <div><strong>Policy signals:</strong> presence of privacy/cookie policy pages and policy disclosures.</div>
          <div><strong>AI signals:</strong> issues inferred from patterns common to GDPR requirements.</div>
        </div>
        ${h3('Limitations')}
        <div style="font-size:13px;color:${TEXT_MUTED};line-height:1.8;">
          <div>Automated scanning cannot confirm internal processing activities, contracts, or organisational measures.</div>
          <div>Some requirements depend on business context (legal bases, retention, international transfers).</div>
          <div>Results may include false positives/negatives due to dynamic content or blocked resources.</div>
        </div>
      `, INFO_BG, ACCENT)
    : '';

  const technicalAppendix = fullReport
    ? sectionTitle('Technical Appendix') +
      card(`
        ${h3('Detected Signals')}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          <div style="font-size:13px;color:${TEXT_MUTED};line-height:1.8;">
            <div><strong>Status Code:</strong> ${esc(String(crawl.statusCode ?? 'Unknown'))}</div>
            <div><strong>HTTPS Enabled:</strong> ${crawl.hasSSL ? `<span style="color:${SUCCESS};font-weight:700;">Yes</span>` : `<span style="color:${FAIL};font-weight:700;">No</span>`}</div>
            <div><strong>Forms:</strong> ${esc(String(crawl.formsCount ?? 0))}</div>
            <div><strong>Form Inputs Labeled:</strong> ${esc(String((crawl as any).formInputsLabeled ?? 'n/a'))} / ${esc(String((crawl as any).totalFormInputs ?? 'n/a'))}</div>
          </div>
          <div style="font-size:13px;color:${TEXT_MUTED};line-height:1.8;">
            <div><strong>Privacy Policy URL:</strong> ${(crawl as any).privacyPolicyUrl ? esc((crawl as any).privacyPolicyUrl) : 'n/a'}</div>
            <div><strong>Cookie Banner:</strong> ${(crawl as any).hasCookieBanner ? `<span style="color:${SUCCESS};font-weight:700;">Detected</span>` : `<span style="color:${WARN};font-weight:700;">Not detected</span>`}</div>
            <div><strong>Cookie Policy:</strong> ${(crawl as any).hasCookiePolicyPage ? `<span style="color:${SUCCESS};font-weight:700;">Found</span>` : `<span style="color:${WARN};font-weight:700;">Not detected</span>`}</div>
          </div>
        </div>
        ${h3('Tracking Scripts')}
        ${crawl.trackingScripts?.length
          ? `<div style="font-size:12px;color:${TEXT_MUTED};line-height:1.6;font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;">
              ${crawl.trackingScripts.map((s: string) => `<div style="padding:6px 0;border-bottom:1px solid ${BORDER};word-break:break-all;">${esc(s)}</div>`).join('')}
            </div>`
          : `<div style="font-size:13px;color:${TEXT_MUTED};">No tracking scripts detected.</div>`}
        ${h3('Third-Party Embeds')}
        ${crawl.thirdPartyEmbeds?.length
          ? `<div style="font-size:13px;color:${TEXT_MUTED};line-height:1.8;">${crawl.thirdPartyEmbeds.map((e: string) => `<div>• ${esc(e)}</div>`).join('')}</div>`
          : `<div style="font-size:13px;color:${TEXT_MUTED};">No third-party embeds detected.</div>`}
      `, WHITE, BORDER)
    : '';

  const glossary = fullReport
    ? sectionTitle('Glossary') +
      card(`
        <div style="font-size:13px;color:${TEXT_MUTED};line-height:1.8;">
          <div><strong>Controller:</strong> Entity that determines the purposes and means of processing.</div>
          <div><strong>Processor:</strong> Entity that processes personal data on behalf of a controller.</div>
          <div><strong>Legal Basis:</strong> The GDPR justification for processing (consent, contract, legitimate interest, etc.).</div>
          <div><strong>CMP:</strong> Consent Management Platform controlling cookie and tracking consent.</div>
          <div><strong>SCCs:</strong> Standard Contractual Clauses for international data transfers.</div>
        </div>
      `, INFO_BG, ACCENT)
    : '';

  const remediationItems = [
    ...displayedFailedChecks.map(c => ({ text: `Fix: ${esc(c.name)} — ${esc(c.recommendation || 'See recommendation above')}`, done: false })),
    ...(displayedIssues.filter((i: any) => Boolean(i?.fix)).map((i: any) => ({ text: `AI Fix: ${esc(i.title)} — ${esc(i.fix)}`, done: false }))),
  ];

  const remediationSection = fullReport
    ? sectionTitle('Remediation Action Plan') +
      card(`
        <p style="margin:0 0 16px;font-size:13px;color:${TEXT_MUTED};">Use this checklist to address the findings in priority order:</p>
        ${remediationItems.length
          ? remediationItems.map((item: { text: string; done: boolean }) => checklistItem(item.text, item.done ? 'done' : 'todo')).join('')
          : '<div style="color:#16a34a;font-size:14px;"><svg width="14" height="14" viewBox="0 0 24 24" style="vertical-align:middle;margin-right:4px"><circle cx="12" cy="12" r="11" fill="#16a34a"/><path d="M7 12.5l3.5 3.5 6.5-7" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>No remediation items — your site appears fully compliant!</div>'
        }
      `, WARN_BG, WARN)
    : sectionTitle('Remediation Action Plan') +
      card(`
        <div style="text-align:center;padding:16px 0;">
          <div style="font-size:15px;font-weight:600;color:${TEXT};margin-bottom:8px;">Remediation Plan Available in Full Report</div>
          <p style="font-size:13px;color:${TEXT_MUTED};margin:0 0 16px;">Get a complete prioritised checklist of fixes for all failed checks and AI-detected issues.</p>
          <div style="background:#eff6ff;border:1px solid ${ACCENT};border-radius:8px;padding:12px 16px;font-size:13px;color:${ACCENT};display:inline-block;">
            Upgrade to unlock the full remediation action plan
          </div>
        </div>
      `, INFO_BG);

  const footer = `
  <div style="margin-top:60px;padding-top:20px;border-top:1px solid ${BORDER};display:flex;justify-content:space-between;align-items:center;font-size:11px;color:${TEXT_MUTED};">
    <div style="display:flex;align-items:center;gap:8px;">
      ${branding?.logoUrl || branding?.logoDataUrl ? `<img alt="Logo" src="${esc(branding.logoUrl || branding.logoDataUrl)}" style="height:18px;max-width:140px;object-fit:contain;" />` : ''}
      <span>Generated by <strong>${esc(branding?.agencyName || 'ComplyScan')}</strong></span>
    </div>
    <div>This tool provides automated analysis and does not constitute legal advice.</div>
    <div>Report generated: ${scanDate} · CONFIDENTIAL</div>
  </div>`;

  const printStyles = `
  @page { size: A4; margin: 18mm 15mm; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-print { display: none !important; }
  }
  .page-break { break-before: page; page-break-before: always; }
  .avoid-break { break-inside: avoid; page-break-inside: avoid; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 24px; color: ${TEXT}; background: ${WHITE}; font-size: 13px; line-height: 1.5; }
  a { color: ${ACCENT}; text-decoration: none; }
  `;

  const prefacePages = fullReport ? `${tocPage}${pageBreak()}${keyFindingsPage}${pageBreak()}` : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>GDPR Compliance Report — ${esc(url)}</title>
  <style>${printStyles}</style>
</head>
<body>
  ${coverPage}
  ${prefacePages}
  ${execSummary}
  ${scoreBreakdown}
  ${checksSection}
  ${aiIssuesSection}
  ${policySection}
  ${gdprRef}
  ${remediationSection}
  ${fullReport ? pageBreak() : ''}
  ${methodologySection}
  ${fullReport ? pageBreak() : ''}
  ${technicalAppendix}
  ${fullReport ? pageBreak() : ''}
  ${glossary}
  ${footer}
</body>
</html>`;
}

// Compatibility alias used by newer PDF pipeline code paths.
export function generateReportHTML(url: string, result: ScanResult | NormalizedScanResultV2, fullReport = true, branding?: Branding): string {
  return generateReportHtml(url, result as any, fullReport, branding);
}
