export const MOCK_SCAN_MODE = process.env.MOCK_SCANS === '1' || process.env.MOCK_STRIPE === '1' || process.env.E2E_TEST_MODE === '1';

export function buildMockScanResult(url: string) {
  const hostname = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  })();

  return {
    crawl: {
      url,
      title: `Mock GDPR Scan for ${hostname}`,
      description: `Deterministic mock scan result for ${hostname}`,
      h1s: ['Privacy-first website'],
      trackingScripts: ['https://www.googletagmanager.com/gtm.js'],
      formsCount: 2,
      formInputsLabeled: 2,
      totalFormInputs: 3,
      hasSSL: true,
      statusCode: 200,
      hasPrivacyPolicy: true,
      hasCookiePolicyPage: true,
      hasCookieBanner: true,
      cookieBannerText: 'We use cookies to improve your experience.',
      privacyPolicyUrl: `${url.replace(/\/$/, '')}/privacy`,
      thirdPartyEmbeds: ['YouTube embed'],
    },
    ruleChecks: [
      {
        name: 'Privacy Policy',
        severity: 'info',
        passed: true,
        detail: 'A privacy policy page was detected.',
        recommendation: 'Keep the policy updated when processors or retention policies change.',
      },
      {
        name: 'Cookie Consent',
        severity: 'warning',
        passed: false,
        detail: 'Cookie banner found, but explicit reject controls were not detected.',
        recommendation: 'Add a Reject All option and granular cookie preferences.',
      },
      {
        name: 'International Transfers',
        severity: 'critical',
        passed: false,
        detail: 'Third-party processors suggest possible international transfers without a clear disclosure.',
        recommendation: 'Document transfer mechanisms and SCC usage in your privacy notice.',
      },
    ],
    aiAnalysis: {
      summary: `${hostname} appears partially compliant, but cookie consent and international transfer disclosures still need work.`,
      riskLevel: 'medium',
      issues: [
        {
          title: 'Cookie banner lacks a clear reject path',
          description: 'Visitors should be able to reject non-essential cookies as easily as they accept them.',
          severity: 'warning',
          fix: 'Add a first-layer Reject All control and category-level preferences.',
        },
        {
          title: 'Processor transfer disclosure is incomplete',
          description: 'Use of third-party processors implies international data transfers that must be disclosed.',
          severity: 'critical',
          fix: 'List processors, transfer regions, and safeguards such as SCCs in the privacy policy.',
        },
      ],
      positives: ['HTTPS enabled', 'Privacy policy detected', 'Cookie banner detected'],
      gdprScore: 72,
    },
    scannedAt: new Date().toISOString(),
  };
}
