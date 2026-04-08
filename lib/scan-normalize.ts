import type { CrawlResult } from './crawler';

export type NormalizedIssueSeverity = 'critical' | 'warning' | 'info';

export type NormalizedIssue = {
  type: string;
  severity: NormalizedIssueSeverity;
  title: string;
  impact: string;
  fix: string;
  evidence: Record<string, unknown>;
  gdprArticle?: string;
};

export type NormalizedScanResultV2 = {
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
    ruleChecks: any[];
    aiAnalysis: any;
  };
};

function clampScore(score: unknown): number {
  const n = typeof score === 'number' ? score : Number(score);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function normalizeRiskLevel(risk: unknown): NormalizedScanResultV2['risk'] {
  const r = String(risk || '').toLowerCase().trim();
  if (r === 'critical') return 'critical';
  if (r === 'high') return 'high';
  if (r === 'medium') return 'medium';
  if (r === 'low') return 'low';
  // Some mocks used "MEDIUM" etc; default medium.
  return 'medium';
}

function aiIssueToNormalized(aiIssue: any): NormalizedIssue {
  const severity = String(aiIssue?.severity || '').toLowerCase();
  const s: NormalizedIssueSeverity =
    severity === 'critical' ? 'critical' :
    severity === 'warning' ? 'warning' :
    severity === 'info' ? 'info' :
    // tolerate "high/medium/low" from older mocks
    severity === 'high' ? 'critical' :
    severity === 'medium' ? 'warning' :
    'info';

  return {
    type: (aiIssue?.type || 'ai_finding') as string,
    severity: s,
    title: String(aiIssue?.title || 'AI finding'),
    impact: String(aiIssue?.impact || aiIssue?.description || ''),
    fix: String(aiIssue?.fix || ''),
    evidence: aiIssue?.evidence ? { ...aiIssue.evidence } : {},
    gdprArticle: aiIssue?.gdprArticle ? String(aiIssue.gdprArticle) : undefined,
  };
}

function ruleCheckToNormalized(ruleCheck: any, crawl: CrawlResult): NormalizedIssue | null {
  if (ruleCheck?.passed === true) return null;
  const severity = (ruleCheck?.severity || 'warning') as string;
  const s: NormalizedIssueSeverity =
    severity === 'critical' ? 'critical' :
    severity === 'warning' ? 'warning' :
    'info';

  return {
    type: String(ruleCheck?.id || 'rule_check'),
    severity: s,
    title: String(ruleCheck?.name || 'Failed check'),
    impact: String(ruleCheck?.detail || ''),
    fix: String(ruleCheck?.recommendation || ''),
    evidence: {
      url: crawl.url,
      cookieBannerText: crawl.cookieBannerText,
      trackingScripts: crawl.trackingScripts,
    },
    gdprArticle: ruleCheck?.gdprArticle ? String(ruleCheck.gdprArticle) : undefined,
  };
}

export function normalizeScanResultV2(input: {
  url: string;
  scannedAt: string;
  crawl: CrawlResult;
  ruleChecks: any[];
  aiAnalysis: any;
}): NormalizedScanResultV2 {
  const score = clampScore(input.aiAnalysis?.gdprScore);
  const risk = normalizeRiskLevel(input.aiAnalysis?.riskLevel);
  const summary = String(input.aiAnalysis?.summary || '');

  const issues: NormalizedIssue[] = [];
  for (const rc of input.ruleChecks || []) {
    const issue = ruleCheckToNormalized(rc, input.crawl);
    if (issue) issues.push(issue);
  }
  for (const aiIssue of input.aiAnalysis?.issues || []) {
    issues.push(aiIssueToNormalized(aiIssue));
  }

  return {
    version: 2,
    url: input.url,
    scannedAt: input.scannedAt,
    score,
    risk,
    summary,
    positives: Array.isArray(input.aiAnalysis?.positives) ? input.aiAnalysis.positives.map(String) : [],
    issues,
    signals: {
      hasSSL: Boolean(input.crawl.hasSSL),
      statusCode: Number(input.crawl.statusCode || 0),
      hasPrivacyPolicy: Boolean(input.crawl.hasPrivacyPolicy),
      privacyPolicyUrl: input.crawl.privacyPolicyUrl ?? null,
      hasCookieBanner: Boolean(input.crawl.hasCookieBanner),
      cookieBannerText: input.crawl.cookieBannerText ?? null,
      trackingScripts: Array.isArray(input.crawl.trackingScripts) ? input.crawl.trackingScripts : [],
      thirdPartyEmbeds: Array.isArray(input.crawl.thirdPartyEmbeds) ? input.crawl.thirdPartyEmbeds : [],
      hasCookiePolicyPage: Boolean(input.crawl.hasCookiePolicyPage),
      formsCount: Number(input.crawl.formsCount || 0),
      totalFormInputs: Number(input.crawl.totalFormInputs || 0),
      formInputsLabeled: Number(input.crawl.formInputsLabeled || 0),
      mixedContent: (input.crawl as any).mixedContent,
    },
    raw: {
      crawl: input.crawl,
      ruleChecks: input.ruleChecks,
      aiAnalysis: input.aiAnalysis,
    },
  };
}

export function isNormalizedScanResultV2(obj: any): obj is NormalizedScanResultV2 {
  return Boolean(obj && typeof obj === 'object' && obj.version === 2 && typeof obj.score === 'number' && Array.isArray(obj.issues));
}

