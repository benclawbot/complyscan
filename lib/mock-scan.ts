export const MOCK_SCAN_MODE = process.env.MOCK_SCANS === '1' || process.env.MOCK_STRIPE === '1' || process.env.E2E_TEST_MODE === '1';

export function buildMockScanResult(url: string, paid = false) {
  const hostname = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  })();

  // ── Free Preview ─────────────────────────────────────────────────────────────
  const freeRuleChecks = [
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
  ];

  const freeAiIssues = [
    {
      title: 'Cookie banner lacks a clear reject path',
      description: 'Visitors should be able to reject non-essential cookies as easily as they accept them.',
      severity: 'warning',
      fix: 'Add a first-layer Reject All control and category-level preferences.',
      gdprArticle: '7',
    },
    {
      title: 'Processor transfer disclosure is incomplete',
      description: 'Use of third-party processors implies international data transfers that must be disclosed.',
      severity: 'critical',
      fix: 'List processors, transfer regions, and safeguards such as SCCs in the privacy policy.',
      gdprArticle: '46',
    },
  ];

  // ── Paid Full Report ────────────────────────────────────────────────────────
  const paidRuleChecks = [
    ...freeRuleChecks,
    {
      name: 'SSL/TLS Encryption',
      severity: 'info',
      passed: true,
      detail: 'HTTPS is enabled and a valid certificate was detected.',
      gdprArticle: '32',
    },
    {
      name: 'Data Retention Policy',
      severity: 'critical',
      passed: false,
      detail: 'No explicit data retention periods were found in the privacy policy.',
      recommendation: 'Define and document retention periods for each data category.',
      gdprArticle: '5',
    },
    {
      name: 'Consent Mechanism',
      severity: 'warning',
      passed: false,
      detail: 'Forms collect data without a clear affirmative consent mechanism.',
      recommendation: 'Add explicit opt-in checkboxes for marketing communications.',
      gdprArticle: '7',
    },
    {
      name: 'Right to Access',
      severity: 'warning',
      passed: false,
      detail: 'No mechanism described for users to request a copy of their personal data.',
      recommendation: 'Provide a data access request form or contact email.',
      gdprArticle: '15',
    },
    {
      name: 'Right to Erasure',
      severity: 'warning',
      passed: false,
      detail: 'No explicit process for users to request deletion of their personal data.',
      recommendation: 'Document and publish a data deletion request process.',
      gdprArticle: '17',
    },
    {
      name: 'Third-Party Processors',
      severity: 'warning',
      passed: false,
      detail: 'Use of Google Analytics and meta pixel detected without processor list disclosure.',
      recommendation: 'List all third-party processors in the privacy policy with their purposes.',
      gdprArticle: '28',
    },
    {
      name: 'DPIA Requirement',
      severity: 'critical',
      passed: false,
      detail: 'Use of meta pixel and Google Analytics may constitute high-risk processing requiring a DPIA.',
      recommendation: 'Conduct a Data Protection Impact Assessment for tracking scripts.',
      gdprArticle: '35',
    },
    {
      name: 'Cookie Policy',
      severity: 'warning',
      passed: false,
      detail: 'Cookie policy page found but does not list all cookies or their purposes.',
      recommendation: 'List every cookie by name, purpose, and duration in the cookie policy.',
      gdprArticle: '13',
    },
    {
      name: 'Children\'s Data',
      severity: 'critical',
      passed: false,
      detail: 'No age verification or parental consent mechanism detected despite tracking.',
      recommendation: 'Add age verification or parental consent if services may be used by children.',
      gdprArticle: '8',
    },
    {
      name: 'Privacy by Design',
      severity: 'info',
      passed: true,
      detail: 'Some privacy-protective measures detected in form labeling.',
      gdprArticle: '25',
    },
  ];

  const paidAiIssues = [
    ...freeAiIssues,
    {
      title: 'Excessive tracking via meta pixel',
      description: 'The meta pixel was detected on conversion pages and may transmit user behaviour and contact data to meta without adequate disclosure or consent.',
      severity: 'critical',
      fix: 'Conduct a DPIA before using meta pixel. Document the legal basis (likely consent) and disclose the data transfer in your privacy policy. Consider a cookie consent manager.',
      evidence: 'meta pixel code found on /checkout and /success pages',
      gdprArticle: '35',
    },
    {
      title: 'No data retention schedule',
      description: 'The privacy policy does not specify how long personal data is retained, which is required under GDPR Article 13(2)(a).',
      severity: 'critical',
      fix: 'Define and publish retention periods for each category of personal data (e.g., transaction data: 7 years, account data: 3 years after last login, marketing data: until consent withdrawn).',
      gdprArticle: '13',
    },
    {
      title: 'Google Analytics without adequate safeguards',
      description: 'GA4 was detected transmitting visitor data to Google servers in the US. Standard contractual clauses or equivalent safeguards must be documented.',
      severity: 'critical',
      fix: 'Implement a GDPR-compliant analytics solution (e.g., Plausible, Matomo self-hosted, or GA4 with IP anonymisation and a signed data processing agreement with Google).',
      evidence: 'googletagmanager.com/gtm.js detected',
      gdprArticle: '46',
    },
    {
      title: 'No formal data breach notification procedure',
      description: 'The privacy policy does not describe how or when the supervisory authority and affected individuals would be notified in the event of a data breach.',
      severity: 'critical',
      fix: 'Document your internal breach detection and notification procedure. Under GDPR Article 33, breaches must be reported to the supervisory authority within 72 hours.',
      gdprArticle: '33',
    },
    {
      title: 'Marketing consent is pre-ticked',
      description: 'Newsletter and marketing sign-up forms appear to use pre-ticked consent boxes, which do not constitute valid GDPR consent.',
      severity: 'critical',
      fix: 'Remove all pre-ticked boxes. Consent must be a clear affirmative action (e.g., an unticked checkbox with plain-language label).',
      evidence: 'pre-ticked checkbox observed on footer newsletter form',
      gdprArticle: '7',
    },
    {
      title: 'Missing data processor agreements',
      description: 'No evidence of Data Processing Agreements (DPAs) with key processors such as Google (Analytics) and Meta (Pixel). Using processors without DPAs violates GDPR Article 28.',
      severity: 'critical',
      fix: 'Execute GDPR DPAs with all third-party processors. Most major vendors provide standard clauses through their privacy settings or on request.',
      gdprArticle: '28',
    },
    {
      title: 'Contact form lacks lawful basis disclosure',
      description: 'The contact form does not explain what data is collected, why, or how it will be used — violating transparency requirements.',
      severity: 'warning',
      fix: 'Add a privacy notice adjacent to the contact form stating: (1) the legal basis for processing, (2) the controller\'s identity, (3) how long data will be kept, and (4) data subject rights.',
      gdprArticle: '13',
    },
    {
      title: 'No cookie consent management platform',
      description: 'No evidence of a GDPR-compliant cookie consent management platform (CMP). Cookie banners that don\'t prevent tracking until consent are non-compliant.',
      severity: 'critical',
      fix: 'Implement a proper CMP (e.g., Cookiebot, OneTrust, or Osano) that prevents non-essential cookies from being set until the user consents.',
      gdprArticle: '7',
    },
    {
      title: 'Joint controllership with Meta not disclosed',
      description: 'Use of the Meta pixel may establish joint controllership between your organisation and Meta Platforms Ireland Limited under GDPR Article 26, requiring a joint controller agreement.',
      severity: 'warning',
      fix: 'If using Meta pixel, enter into a joint controller arrangement with Meta and disclose this in your privacy policy.',
      gdprArticle: '26',
    },
    {
      title: 'Privacy policy not updated since 2022',
      description: 'The privacy policy footer indicates it was last reviewed in 2022. GDPR practices evolve — policies should be reviewed at least annually.',
      severity: 'info',
      fix: 'Schedule an annual review of the privacy policy. Update it to reflect current data practices, new processors, and any regulatory changes.',
      gdprArticle: '12',
    },
    {
      title: 'No mechanism for withdrawing consent',
      description: 'While consent is obtained, no easy mechanism is provided for users to withdraw it, as required by GDPR Article 7(3).',
      severity: 'warning',
      fix: 'Provide an equally easy way to withdraw consent as to give it (e.g., an unsubscribe link in every email, or a "Withdraw Consent" option in the account settings).',
      gdprArticle: '7',
    },
    {
      title: 'International transfer risk: Google Analytics',
      description: 'Google Analytics transfers personal data to the United States. The EU-US Data Framework may not provide adequate protection without supplementary measures.',
      severity: 'critical',
      fix: 'Implement supplementary measures such as server-side tagging, IP anonymisation, and ensure your Google DPA covers the relevant transfer mechanism.',
      evidence: 'EU-US Data Framework adequacy decision may not fully apply — assess SCCs or binding corporate rules',
      gdprArticle: '46',
    },
  ];

  const ruleChecks = paid ? paidRuleChecks : freeRuleChecks;
  const aiIssues = paid ? paidAiIssues : freeAiIssues;
  const gdprScore = paid ? 54 : 72;

  return {
    crawl: {
      url,
      title: `GDPR Compliance Scan — ${hostname}`,
      description: `Automated GDPR compliance analysis for ${hostname}`,
      h1s: ['Privacy Policy', 'Contact', 'Services'],
      trackingScripts: paid
        ? ['https://www.googletagmanager.com/gtm.js', 'https://connect.facebook.net/en_US/fbevents.js', 'https://www.google-analytics.com/analytics.js']
        : ['https://www.googletagmanager.com/gtm.js'],
      formsCount: paid ? 4 : 2,
      formInputsLabeled: paid ? 5 : 2,
      totalFormInputs: paid ? 8 : 3,
      hasSSL: true,
      statusCode: 200,
      hasPrivacyPolicy: true,
      hasCookiePolicyPage: true,
      hasCookieBanner: true,
      cookieBannerText: 'We use cookies to personalise content and analyse traffic. By continuing you agree to our use of cookies.',
      privacyPolicyUrl: `${url.replace(/\/$/, '')}/privacy`,
      thirdPartyEmbeds: paid ? ['YouTube embed', 'Meta Pixel', 'Google Fonts'] : ['YouTube embed'],
    },
    ruleChecks,
    aiAnalysis: {
      summary: paid
        ? `${hostname} has significant GDPR compliance gaps that require immediate attention. Critical issues were found in cookie consent, third-party tracking, international data transfers, data retention, and breach notification procedures. Urgent remediation is recommended before continued use of tracking technologies.`
        : `${hostname} appears partially compliant, but cookie consent and international transfer disclosures still need work.`,
      riskLevel: paid ? 'high' : 'medium',
      issues: aiIssues,
      positives: paid
        ? ['HTTPS enabled', 'Privacy policy present', 'Cookie banner detected', 'Basic contact form present']
        : ['HTTPS enabled', 'Privacy policy detected', 'Cookie banner detected'],
      gdprScore,
    },
    scannedAt: new Date().toISOString(),
  };
}
