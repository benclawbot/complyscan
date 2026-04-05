export interface GdprCheck {
  id: string;
  name: string;
  description: string;
  severity: 'critical' | 'warning' | 'info';
  passed: boolean;
  detail: string;
  recommendation: string;
}

export function runRuleBasedChecks(crawlResult: any): GdprCheck[] {
  const checks: GdprCheck[] = [];

  // ── Existing checks ────────────────────────────────────────────────────────

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
    detail: crawlResult.hasPrivacyPolicy
      ? `Privacy policy found at: ${crawlResult.privacyPolicyUrl || 'linked on page'}`
      : 'No privacy policy link detected',
    recommendation: crawlResult.hasPrivacyPolicy ? '' : 'Add a privacy policy page and link it in the footer',
  });

  checks.push({
    id: 'cookie_consent',
    name: 'Cookie Consent Banner',
    description: 'EU law requires cookie consent before setting non-essential cookies',
    severity: 'critical',
    passed: crawlResult.hasCookieBanner,
    detail: crawlResult.hasCookieBanner
      ? `Cookie banner detected: "${(crawlResult.cookieBannerText || '').slice(0, 100)}"`
      : 'No cookie consent banner detected',
    recommendation: crawlResult.hasCookieBanner ? '' : 'Add a GDPR-compliant cookie consent banner',
  });

  checks.push({
    id: 'tracking_scripts',
    name: 'Third-Party Tracking Scripts',
    description: 'Tracking scripts (Google Analytics, Meta Pixel, etc.) require consent under GDPR',
    severity: crawlResult.trackingScripts.length > 0 ? 'warning' : 'info',
    passed: crawlResult.trackingScripts.length === 0,
    detail: crawlResult.trackingScripts.length > 0
      ? `Found: ${crawlResult.trackingScripts.join(', ')}`
      : 'No known tracking scripts detected',
    recommendation: crawlResult.trackingScripts.length > 0
      ? 'Ensure these scripts only load after explicit user consent. Use a consent management platform.'
      : '',
  });

  checks.push({
    id: 'form_labels',
    name: 'Form Input Labels',
    description: 'Form inputs must have labels for accessibility and GDPR transparency',
    severity: 'warning',
    passed: crawlResult.totalFormInputs === 0
      || (crawlResult.formInputsLabeled / crawlResult.totalFormInputs) >= 0.8,
    detail: crawlResult.totalFormInputs === 0
      ? 'No form inputs found'
      : `${crawlResult.formInputsLabeled}/${crawlResult.totalFormInputs} inputs have labels (${Math.round((crawlResult.formInputsLabeled / Math.max(crawlResult.totalFormInputs, 1)) * 100)}%)`,
    recommendation: crawlResult.totalFormInputs > 0
      && (crawlResult.formInputsLabeled / crawlResult.totalFormInputs) < 0.8
      ? 'Add <label> elements or aria-label attributes to all form inputs'
      : '',
  });

  // ── New checks ─────────────────────────────────────────────────────────────

  // 1. Security Headers
  const securityHeaders = crawlResult.securityHeaders || {};
  const securityHeaderChecks = [
    { key: 'content-security-policy', label: 'Content-Security-Policy (CSP)' },
    { key: 'x-frame-options', label: 'X-Frame-Options' },
    { key: 'x-content-type-options', label: 'X-Content-Type-Options' },
    { key: 'referrer-policy', label: 'Referrer-Policy' },
    { key: 'permissions-policy', label: 'Permissions-Policy' },
  ];
  const missingHeaders = securityHeaderChecks
    .filter(h => !securityHeaders[h.key]?.toLowerCase().startsWith('not-'))
    .map(h => h.label);
  checks.push({
    id: 'security_headers',
    name: 'Security Headers',
    description: 'Security headers protect the site from clickjacking, MIME-type sniffing, and injection attacks',
    severity: missingHeaders.length >= 3 ? 'critical' : missingHeaders.length > 0 ? 'warning' : 'info',
    passed: missingHeaders.length === 0,
    detail: missingHeaders.length === 0
      ? 'All recommended security headers are present'
      : `Missing: ${missingHeaders.join(', ')}`,
    recommendation: missingHeaders.length > 0
      ? `Add the missing security headers. At minimum include: X-Content-Type-Options: nosniff, X-Frame-Options: DENY, and Content-Security-Policy.`
      : '',
  });

  // 2. Cookie Policy Page (separate from Privacy Policy)
  const cookiePageExists = crawlResult.hasCookiePolicyPage === true;
  checks.push({
    id: 'cookie_policy_page',
    name: 'Cookie Policy Page',
    description: 'A dedicated cookie policy page (separate from the main privacy policy) is required under the ePrivacy Directive / GDPR',
    severity: 'warning',
    passed: cookiePageExists,
    detail: cookiePageExists
      ? 'A dedicated cookie policy page was found'
      : 'No separate cookie policy page detected',
    recommendation: cookiePageExists ? '' : 'Create a dedicated /cookie-policy page describing your use of cookies and link it from your cookie banner and footer',
  });

  // 3. Third-Party Embeds / iframes
  const embeds = crawlResult.thirdPartyEmbeds || [];
  checks.push({
    id: 'third_party_embeds',
    name: 'Third-Party Embeds / iframes',
    description: 'Embedded third-party content (YouTube, Twitter, Google Maps) requires user consent and may transfer data internationally',
    severity: embeds.length > 0 ? 'warning' : 'info',
    passed: embeds.length === 0,
    detail: embeds.length > 0
      ? `Embeds detected: ${embeds.join(', ')}`
      : 'No known third-party embeds detected',
    recommendation: embeds.length > 0
      ? 'Ensure third-party embeds load only after explicit user consent. Consider replacing with no-cookie/privacy-friendly alternatives.'
      : '',
  });

  // 4. Mixed Content
  const mixedContent = crawlResult.mixedContent || false;
  checks.push({
    id: 'mixed_content',
    name: 'Mixed Content',
    description: 'HTTPS pages must not load HTTP (insecure) resources — this is a security and GDPR issue',
    severity: mixedContent ? 'critical' : 'info',
    passed: !mixedContent,
    detail: mixedContent
      ? 'HTTP resources are being loaded on this HTTPS page (mixed content)'
      : 'No mixed content detected — all resources loaded securely',
    recommendation: mixedContent
      ? 'Update all HTTP resource URLs to HTTPS to prevent mixed content warnings and security vulnerabilities'
      : '',
  });

  // 5. Marketing Opt-in (forms have explicit, non-pre-checked marketing consent)
  const marketingOptinStatus = crawlResult.marketingOptinStatus || 'not_checked';
  checks.push({
    id: 'marketing_optin',
    name: 'Marketing Opt-in',
    description: 'Marketing consent must be explicit (checkbox, not pre-checked) per GDPR Art. 7 — consent must be freely given',
    severity: marketingOptinStatus === 'missing' ? 'critical'
      : marketingOptinStatus === 'pre_checked' ? 'warning'
      : 'info',
    passed: marketingOptinStatus === 'present_not_prechecked',
    detail:
      marketingOptinStatus === 'present_not_prechecked' ? 'Marketing consent checkbox is present and not pre-checked'
      : marketingOptinStatus === 'pre_checked' ? 'Marketing consent is pre-checked — this is NOT valid consent under GDPR'
      : marketingOptinStatus === 'missing' ? 'No marketing consent checkbox found on any form'
      : 'No forms found on the page',
    recommendation: marketingOptinStatus !== 'present_not_prechecked'
      ? 'Add an explicit, unchecked checkbox for marketing communications. Consent must never be pre-checked.'
      : '',
  });

  // 6. Data Processor Disclosure (in privacy policy)
  const processorDisclosure = crawlResult.processorDisclosure || false;
  const processorsFound = crawlResult.processorsFound || [];
  checks.push({
    id: 'data_processor_disclosure',
    name: 'Data Processor Disclosure',
    description: 'GDPR Art. 28 requires the privacy policy to name all third-party data processors (Google Analytics, Stripe, Meta, Hotjar, etc.)',
    severity: 'critical',
    passed: processorDisclosure,
    detail: processorDisclosure
      ? `Processors mentioned: ${processorsFound.join(', ')}`
      : 'No third-party data processors identified in privacy policy',
    recommendation: processorDisclosure ? '' : 'List all third-party services that process personal data (analytics, payment processors, CRM, etc.) in your privacy policy, including their purpose and legal basis',
  });

  // 7. International Transfer Disclosure (EU → US transfers, SCCs, adequacy decisions)
  const hasTransferDisclosure = crawlResult.hasInternationalTransferDisclosure || false;
  checks.push({
    id: 'international_transfer',
    name: 'International Transfer Disclosure',
    description: 'When transferring EU personal data outside the EU (e.g. to the US), GDPR Art. 44-49 requires disclosure and a legal transfer mechanism',
    severity: 'critical',
    passed: hasTransferDisclosure,
    detail: hasTransferDisclosure
      ? 'International transfer disclosures found in privacy policy'
      : 'No mention of international data transfers or transfer mechanisms (SCCs, adequacy decisions, BCRs) in privacy policy',
    recommendation: hasTransferDisclosure ? '' : 'Add a section to your privacy policy describing international transfers, the transfer mechanism used (e.g. Standard Contractual Clauses), and the safeguards in place',
  });

  // 8. Data Retention Disclosure
  const hasRetentionDisclosure = crawlResult.hasDataRetentionDisclosure || false;
  const retentionDetails = crawlResult.retentionDetails || null;
  checks.push({
    id: 'data_retention',
    name: 'Data Retention Disclosure',
    description: 'GDPR Art. 13(2)(a) requires the privacy policy to specify the period for which personal data will be stored, or the criteria used to determine that period',
    severity: 'critical',
    passed: hasRetentionDisclosure,
    detail: hasRetentionDisclosure
      ? retentionDetails ? `Retention period found: ${retentionDetails}` : 'Data retention periods are disclosed in the privacy policy'
      : 'No data retention periods specified in the privacy policy',
    recommendation: hasRetentionDisclosure ? '' : 'Add a "Data Retention" section to your privacy policy specifying how long each category of personal data is kept, or the criteria used to determine retention periods',
  });

  // 9. User Rights Mechanism
  const userRights = crawlResult.userRightsMechanism || false;
  const rightsFound = crawlResult.userRightsFound || [];
  checks.push({
    id: 'user_rights_mechanism',
    name: 'User Rights Mechanism',
    description: 'GDPR Arts. 15-21 require the privacy policy to explain how users can exercise their rights (access, erasure, rectification, portability, objection)',
    severity: 'critical',
    passed: userRights,
    detail: userRights
      ? `Rights mechanism described. Found mentions of: ${rightsFound.join(', ')}`
      : 'No description of how users can exercise their GDPR rights in the privacy policy',
    recommendation: userRights ? '' : 'Add a "Your Rights" or "How to Exercise Your Rights" section to your privacy policy explaining how users can request access, rectification, erasure (right to be forgotten), data portability, and object to processing',
  });

  // 10. DPO Contact
  const dpoFound = crawlResult.dpoContact || null;
  checks.push({
    id: 'dpo_contact',
    name: 'DPO Contact Information',
    description: 'If a Data Protection Officer (DPO) is appointed, their contact details must be made publicly available (GDPR Art. 37(7))',
    severity: dpoFound === 'not_applicable' ? 'info' : dpoFound ? 'info' : 'warning',
    passed: !!dpoFound,
    detail: dpoFound && dpoFound !== 'not_applicable'
      ? `DPO contact found: ${dpoFound}`
      : dpoFound === 'not_applicable'
      ? 'DPO is stated as not applicable for this organization'
      : 'No DPO contact information found in the privacy policy',
    recommendation: dpoFound ? '' : 'If your organization is required to appoint a DPO, add their contact details (name and/or email/address) to your privacy policy. If a DPO is not required, state this clearly.',
  });

  // 11. Supervisory Authority
  const supervisoryAuthority = crawlResult.supervisoryAuthority || null;
  checks.push({
    id: 'supervisory_authority',
    name: 'Supervisory Authority Disclosure',
    description: 'GDPR Art. 13(1)(d) requires the privacy policy to identify the supervisory authority (data protection regulator) users can lodge complaints with',
    severity: 'critical',
    passed: !!supervisoryAuthority,
    detail: supervisoryAuthority
      ? `Supervisory authority identified: ${supervisoryAuthority}`
      : 'No supervisory authority (data protection regulator) mentioned in the privacy policy',
    recommendation: supervisoryAuthority ? '' : 'Add a statement in your privacy policy identifying the supervisory authority users can complain to (e.g. "You have the right to lodge a complaint with the ICO (Information Commissioner\'s Office)"). Include the regulator\'s name and contact details.',
  });

  // 12. Age Restriction
  const ageRestriction = crawlResult.ageRestriction || null;
  checks.push({
    id: 'age_restriction',
    name: 'Age Restriction / Parental Consent',
    description: 'GDPR Art. 8 and the GDPR UK/EU implement rules require websites accessible to children to verify age and obtain parental consent for under-16s (or under-13 in some jurisdictions)',
    severity: ageRestriction === 'present' ? 'info' : 'warning',
    passed: !!ageRestriction,
    detail: ageRestriction === 'present'
      ? 'Age restriction statement found'
      : 'No age restriction or parental consent statement detected',
    recommendation: ageRestriction === 'present' ? '' : 'If your website is accessible to children or you knowingly collect data from children, add an age verification mechanism and parental consent procedure. Add a statement such as "This website is not intended for children under 16."',
  });

  // 13. Automated Decision-Making (Art. 22)
  const hasArt22Disclosure = crawlResult.hasAutomatedDecisionMakingDisclosure || false;
  checks.push({
    id: 'automated_decision_making',
    name: 'Automated Decision-Making Disclosure (Art. 22)',
    description: 'GDPR Art. 22 requires that individuals be informed when automated decision-making, including profiling, produces significant effects, and that suitable safeguards exist',
    severity: 'warning',
    passed: !hasArt22Disclosure,
    detail: hasArt22Disclosure
      ? 'Art. 22 automated decision-making disclosure found in privacy policy'
      : 'No disclosure about automated decision-making or profiling found',
    recommendation: hasArt22Disclosure ? '' : 'If your site uses automated decision-making (e.g. credit decisions, automated profiling), add an Art. 22 disclosure explaining the logic involved, the significance of the processing, and the safeguards in place. If you do not engage in such processing, state this.',
  });

  // 14. Consent Withdrawal Mechanism
  const hasConsentWithdrawal = crawlResult.hasConsentWithdrawalMechanism || false;
  checks.push({
    id: 'consent_withdrawal',
    name: 'Consent Withdrawal Mechanism',
    description: 'GDPR Art. 7(3) requires that users be able to withdraw consent as easily as they gave it',
    severity: 'critical',
    passed: hasConsentWithdrawal,
    detail: hasConsentWithdrawal
      ? 'Consent withdrawal mechanism described in privacy policy'
      : 'No mechanism for withdrawing consent described in the privacy policy',
    recommendation: hasConsentWithdrawal ? '' : 'Describe in your privacy policy how users can withdraw consent (e.g. "email privacy@example.com with the subject \'Withdraw Consent\'" or "update your preferences in your account settings"). The process must be as easy as giving consent.',
  });

  return checks;
}
