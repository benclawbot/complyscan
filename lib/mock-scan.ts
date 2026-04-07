export const MOCK_SCAN_MODE = process.env.MOCK_SCANS === '1' || process.env.MOCK_STRIPE === '1' || process.env.E2E_TEST_MODE === '1';

// Generate a deterministic but varied score based on the URL
function deriveScoreFromUrl(url: string, paid: boolean): number {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    hash = ((hash << 5) - hash) + url.charCodeAt(i);
    hash = hash & hash;
  }
  // Generate scores between 15-85 for paid, 10-60 for free (free is always worse)
  const baseScore = Math.abs(hash % 70) + (paid ? 15 : 10);
  return Math.min(baseScore, paid ? 85 : 60);
}

// Generate varied issues based on URL hash
function generateUrlBasedIssues(url: string, paid: boolean, baseSeverity: 'critical' | 'warning' | 'info') {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    hash = ((hash << 5) - hash) + url.charCodeAt(i);
    hash = hash & hash;
  }
  
  const issues = [];
  const criticalCount = paid ? (Math.abs(hash % 4) + 2) : (Math.abs(hash % 2) + 1);
  const warningCount = paid ? (Math.abs((hash >> 4) % 4) + 2) : (Math.abs((hash >> 4) % 2) + 1);
  
  const criticalTemplates = [
    {
      title: 'No privacy policy detected',
      description: 'This website does not appear to have a privacy policy page, which is required under GDPR Article 13.',
      fix: 'Create a comprehensive privacy policy page that discloses all data collection practices, legal bases, and user rights. Link to it from your footer and any data collection points.',
      gdprArticle: '13',
    },
    {
      title: 'Cookie consent banner missing or non-compliant',
      description: 'No GDPR-compliant cookie consent mechanism was detected. EU law requires consent before setting non-essential cookies.',
      fix: 'Implement a cookie consent management platform (CMP) that blocks non-essential cookies until users explicitly consent. Include reject-all option on the first layer.',
      gdprArticle: '7',
    },
    {
      title: 'International data transfer disclosure missing',
      description: 'Third-party services detected that may transfer data outside the EU without adequate disclosure or safeguards.',
      fix: 'Document all international data transfers in your privacy policy. Implement Standard Contractual Clauses (SCCs) or rely on adequacy decisions for each transfer.',
      gdprArticle: '46',
    },
    {
      title: 'No data retention policy found',
      description: 'The privacy policy does not specify how long personal data is retained, which is required under GDPR Article 13(2)(a).',
      fix: 'Define and document retention periods for each category of personal data. Common periods: transaction data (7 years), account data (3 years after last activity), marketing data (until consent withdrawn).',
      gdprArticle: '13',
    },
    {
      title: 'Third-party tracking without consent mechanism',
      description: 'Google Analytics or similar tracking scripts were detected loading without waiting for user consent.',
      fix: 'Implement a GDPR-compliant tag management solution that only loads tracking scripts after explicit user consent. Use a consent management platform (CMP).',
      gdprArticle: '7',
    },
  ];
  
  const warningTemplates = [
    {
      title: 'Form inputs lack proper labeling',
      description: 'Some form inputs do not have associated labels, affecting accessibility and GDPR transparency requirements.',
      fix: 'Add <label> elements or aria-label attributes to all form inputs. Labels must clearly describe what data is collected and why.',
      gdprArticle: '5',
    },
    {
      title: 'Marketing consent may be pre-checked',
      description: 'Newsletter or marketing sign-up forms may use pre-ticked consent boxes, which do not constitute valid GDPR consent.',
      fix: 'Ensure all marketing consent checkboxes are unchecked by default. Consent must be a clear affirmative action.',
      gdprArticle: '7',
    },
    {
      title: 'Missing data processor disclosure',
      description: 'The privacy policy does not list all third-party data processors as required under GDPR Article 28.',
      fix: 'List all third-party services that process personal data (analytics, payment processors, CRM, etc.) in your privacy policy, including their purposes and legal basis.',
      gdprArticle: '28',
    },
    {
      title: 'No consent withdrawal mechanism',
      description: 'Users cannot easily withdraw consent once given, as required by GDPR Article 7(3).',
      fix: 'Provide an equally easy mechanism to withdraw consent as to give it (e.g., unsubscribe link in emails, account settings option).',
      gdprArticle: '7',
    },
    {
      title: 'Contact form lacks lawful basis disclosure',
      description: 'The contact form does not explain what data is collected, why, or how it will be used.',
      fix: 'Add a privacy notice adjacent to the contact form stating: (1) the legal basis for processing, (2) the controller identity, (3) retention period, and (4) data subject rights.',
      gdprArticle: '13',
    },
    {
      title: 'Security headers missing or incomplete',
      description: 'Essential security headers such as CSP, X-Frame-Options, or X-Content-Type-Options were not detected.',
      fix: 'Add security headers: X-Content-Type-Options: nosniff, X-Frame-Options: DENY, Content-Security-Policy (with strict policy), Referrer-Policy: strict-origin-when-cross-origin.',
      gdprArticle: '32',
    },
    {
      title: 'Cookie policy page not found',
      description: 'A separate cookie policy page was not detected, which is required under the ePrivacy Directive.',
      fix: 'Create a dedicated /cookie-policy page listing all cookies, their purposes, and durations. Link to it from your cookie banner and footer.',
      gdprArticle: '13',
    },
  ];
  
  const infoTemplates = [
    {
      title: 'SSL/TLS encryption enabled',
      description: 'HTTPS is properly configured with a valid certificate.',
      fix: '',
      gdprArticle: '32',
    },
    {
      title: 'Privacy policy page detected',
      description: 'A privacy policy page was found and appears to be accessible.',
      fix: '',
      gdprArticle: '13',
    },
    {
      title: 'Basic cookie banner detected',
      description: 'A cookie consent mechanism was found.',
      fix: 'Ensure the banner provides reject-all option and does not auto-accept.',
      gdprArticle: '7',
    },
  ];

  // Generate critical issues
  for (let i = 0; i < criticalCount && i < criticalTemplates.length; i++) {
    const idx = (Math.abs((hash >> i) % criticalTemplates.length));
    issues.push({
      ...criticalTemplates[idx],
      severity: 'critical' as const,
      evidence: `Issue detected during automated scan of ${url}`,
    });
  }

  // Generate warning issues
  for (let i = 0; i < warningCount && i < warningTemplates.length; i++) {
    const idx = (Math.abs((hash >> (i + 8)) % warningTemplates.length));
    issues.push({
      ...warningTemplates[idx],
      severity: 'warning' as const,
    });
  }
  
  // Add some info items for paid scans
  if (paid) {
    const infoCount = Math.abs((hash >> 12) % 2) + 1;
    for (let i = 0; i < infoCount && i < infoTemplates.length; i++) {
      const idx = (Math.abs((hash >> (i + 16)) % infoTemplates.length));
      issues.push({
        ...infoTemplates[idx],
        severity: 'info' as const,
      });
    }
  }

  return issues;
}

export function buildMockScanResult(url: string, paid = false) {
  const hostname = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  })();

  // Derive a realistic score from the URL
  const gdprScore = deriveScoreFromUrl(url, paid);
  
  // Determine risk level based on score
  const riskLevel = gdprScore >= 75 ? 'low' : gdprScore >= 50 ? 'medium' : gdprScore >= 25 ? 'high' : 'critical';
  
  // Generate issues based on URL
  const aiIssues = generateUrlBasedIssues(url, paid, gdprScore < 50 ? 'critical' : 'warning');

  // Generate rule checks
  const hasSSL = url.startsWith('https://');
  const hasPrivacyPolicy = Math.abs(url.length % 3) !== 0; // Vary based on URL
  const hasCookieBanner = paid || Math.abs((url.length >> 2) % 2) === 0;
  
  const ruleChecks = [
    {
      id: 'ssl',
      name: 'SSL/TLS Encryption',
      severity: 'critical',
      passed: hasSSL,
      detail: hasSSL ? 'HTTPS is enabled and a valid certificate was detected.' : 'HTTPS is not enabled. All websites should use SSL/TLS encryption.',
      recommendation: hasSSL ? '' : 'Install an SSL certificate and redirect all HTTP traffic to HTTPS.',
      gdprArticle: '32',
    },
    {
      id: 'privacy_policy',
      name: 'Privacy Policy Present',
      severity: 'critical',
      passed: hasPrivacyPolicy,
      detail: hasPrivacyPolicy ? `Privacy policy detected at ${url}/privacy or linked on the page.` : 'No privacy policy link detected on the website.',
      recommendation: hasPrivacyPolicy ? '' : 'Create a comprehensive privacy policy page and link to it in the footer.',
      gdprArticle: '13',
    },
    {
      id: 'cookie_consent',
      name: 'Cookie Consent Banner',
      severity: 'critical',
      passed: hasCookieBanner,
      detail: hasCookieBanner ? 'A cookie consent banner was detected on the website.' : 'No cookie consent banner was detected.',
      recommendation: hasCookieBanner ? '' : 'Add a GDPR-compliant cookie consent banner that requires consent before setting non-essential cookies.',
      gdprArticle: '7',
    },
    {
      id: 'tracking_scripts',
      name: 'Third-Party Tracking Scripts',
      severity: aiIssues.some(i => i.title.toLowerCase().includes('tracking')) ? 'warning' : 'info',
      passed: !aiIssues.some(i => i.title.toLowerCase().includes('tracking')),
      detail: aiIssues.some(i => i.title.toLowerCase().includes('tracking')) 
        ? 'Third-party tracking scripts detected that may transfer data without adequate consent.' 
        : 'No aggressive third-party tracking scripts detected.',
      recommendation: aiIssues.some(i => i.title.toLowerCase().includes('tracking'))
        ? 'Implement a consent management platform and only load tracking scripts after explicit user consent.'
        : '',
      gdprArticle: '7',
    },
    {
      id: 'form_labels',
      name: 'Form Input Labels',
      severity: 'warning',
      passed: paid,
      detail: paid ? 'Most form inputs have proper labels for accessibility and transparency.' : 'Some form inputs may lack proper labels.',
      recommendation: paid ? '' : 'Add <label> elements or aria-label attributes to all form inputs.',
      gdprArticle: '5',
    },
    {
      id: 'data_retention',
      name: 'Data Retention Disclosure',
      severity: 'critical',
      passed: paid && gdprScore > 40,
      detail: paid && gdprScore > 40 
        ? 'Data retention periods are disclosed in the privacy policy.' 
        : 'No explicit data retention periods were found in the privacy policy.',
      recommendation: paid && gdprScore > 40 ? '' : 'Define and document retention periods for each category of personal data in your privacy policy.',
      gdprArticle: '13',
    },
    {
      id: 'international_transfer',
      name: 'International Transfer Disclosure',
      severity: 'critical',
      passed: paid && gdprScore > 60,
      detail: paid && gdprScore > 60
        ? 'International transfer disclosures and safeguards were found in the privacy policy.'
        : 'No mention of international data transfers or transfer mechanisms found.',
      recommendation: paid && gdprScore > 60 ? '' : 'Add a section describing international transfers, the transfer mechanism used (SCCs, adequacy decisions), and safeguards in place.',
      gdprArticle: '46',
    },
    {
      id: 'user_rights_mechanism',
      name: 'User Rights Mechanism',
      severity: 'critical',
      passed: paid && gdprScore > 50,
      detail: paid && gdprScore > 50
        ? 'Information about exercising GDPR rights (access, erasure, rectification) was found.'
        : 'No clear description of how users can exercise their GDPR rights.',
      recommendation: paid && gdprScore > 50 ? '' : 'Add a "Your Rights" section explaining how users can request access, rectification, erasure, and data portability.',
      gdprArticle: '15',
    },
  ];

  const criticalCount = ruleChecks.filter(c => c.severity === 'critical' && !c.passed).length;
  const warningCount = ruleChecks.filter(c => c.severity === 'warning' && !c.passed).length;

  const summary = paid
    ? `${hostname} has ${criticalCount > 2 ? 'significant' : criticalCount > 0 ? 'some' : 'few'} GDPR compliance gaps${criticalCount > 0 ? `, including ${criticalCount} critical issue${criticalCount > 1 ? 's' : ''}` : ''}. ${gdprScore >= 50 ? 'The website shows moderate compliance but' : 'Urgent'} remediation is recommended${gdprScore < 50 ? ', particularly regarding cookie consent and privacy policy requirements' : ''}.`
    : `${hostname} shows ${gdprScore >= 50 ? 'partial GDPR compliance with room for improvement' : 'significant GDPR compliance gaps'} in cookie consent, privacy policy completeness${criticalCount > 0 ? `, and ${criticalCount} critical issue${criticalCount > 1 ? 's' : ''}` : ''}. ${gdprScore < 40 ? 'Immediate action is recommended.' : 'Consider upgrading to the full report for detailed remediation steps.'}`;

  const positives = [
    ...(hasSSL ? ['HTTPS encryption enabled'] : []),
    ...(hasPrivacyPolicy ? ['Privacy policy present'] : []),
    ...(hasCookieBanner ? ['Cookie consent mechanism detected'] : []),
    ...(paid && gdprScore > 40 ? ['Data retention disclosures present'] : []),
  ];

  return {
    crawl: {
      url,
      title: `GDPR Compliance Scan — ${hostname}`,
      description: `Automated GDPR compliance analysis for ${hostname}`,
      h1s: ['Privacy Policy', 'Contact', 'Services'],
      trackingScripts: aiIssues.some(i => i.title.toLowerCase().includes('tracking'))
        ? ['https://www.googletagmanager.com/gtm.js', 'https://www.google-analytics.com/analytics.js']
        : [],
      formsCount: paid ? 4 : 2,
      formInputsLabeled: paid ? 5 : 2,
      totalFormInputs: paid ? 8 : 3,
      hasSSL,
      statusCode: 200,
      hasPrivacyPolicy,
      hasCookiePolicyPage: paid,
      hasCookieBanner,
      cookieBannerText: 'We use cookies to personalise content and analyse traffic. By continuing you agree to our use of cookies.',
      privacyPolicyUrl: hasPrivacyPolicy ? `${url.replace(/\/$/, '')}/privacy` : undefined,
      thirdPartyEmbeds: aiIssues.some(i => i.title.toLowerCase().includes('meta') || i.title.toLowerCase().includes('youtube'))
        ? ['YouTube embed', 'Meta Pixel']
        : aiIssues.some(i => i.title.toLowerCase().includes('tracking'))
        ? ['Google Analytics']
        : [],
    },
    ruleChecks,
    aiAnalysis: {
      summary,
      riskLevel,
      issues: aiIssues,
      positives: positives.length > 0 ? positives : ['Basic website structure detected'],
      gdprScore,
    },
    scannedAt: new Date().toISOString(),
  };
}

