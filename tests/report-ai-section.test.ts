import { describe, expect, it } from 'vitest';
import { generateReportHtml } from '@/lib/report';

describe('report AI section rendering', () => {
  it('does not render AI sections when there are only failed rule checks and no AI findings', () => {
    const html = generateReportHtml('https://example.com', {
      crawl: {
        url: 'https://example.com',
        title: 'Example',
        description: 'Example',
        h1s: ['Example'],
        hasPrivacyPolicy: false,
        privacyPolicyUrl: null,
        privacyPolicyHtml: null,
        hasCookieBanner: false,
        cookieBannerText: null,
        trackingScripts: [],
        formsCount: 1,
        formInputsLabeled: 0,
        totalFormInputs: 2,
        hasSSL: true,
        screenshots: [],
        html: '<html></html>',
        statusCode: 200,
        securityHeaders: {},
        hasCookiePolicyPage: false,
        thirdPartyEmbeds: [],
        mixedContent: false,
        marketingOptinStatus: 'missing',
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
      },
      ruleChecks: [
        { id: 'privacy_policy', name: 'Privacy Policy Present', passed: false, detail: 'No privacy policy link detected', recommendation: 'Add a privacy policy page', severity: 'critical' },
      ],
      aiAnalysis: {
        gdprScore: 42,
        riskLevel: 'high',
        summary: 'Rule-based checks found significant gaps.',
        issues: [],
        positives: [],
      },
      scannedAt: '2026-04-11T00:00:00.000Z',
    } as any);

    expect(html).not.toContain('AI-Detected Issues');
    expect(html).toContain('Privacy Policy Present');
  });
});
