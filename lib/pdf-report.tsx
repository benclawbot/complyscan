import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
  Svg,
  Circle,
  Path,
  Rect,
} from '@react-pdf/renderer';
import React from 'react';

// ── Fonts ────────────────────────────────────────────────────────────────────
const FONT_BOLD = 'Helvetica-Bold';
const FONT_OBLIQUE = 'Helvetica-Oblique';

// ── Color palette ─────────────────────────────────────────────────────────────
const C = {
  blue: '#2563eb',
  blueLight: '#dbeafe',
  blueDark: '#1e3a5f',
  green: '#16a34a',
  greenBg: '#f0fdf4',
  amber: '#d97706',
  amberBg: '#fffbeb',
  amberText: '#92400e',
  red: '#dc2626',
  redBg: '#fef2f2',
  text: '#1e293b',
  muted: '#64748b',
  border: '#e2e8f0',
  white: '#ffffff',
  coverBlue1: '#1e3a5f',
  coverBlue2: '#2563eb',
};

// ── SVG Icons ─────────────────────────────────────────────────────────────────
function IconCheck({ size = 16, color = C.green }: { size?: number; color?: string }) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      <Circle cx="12" cy="12" r="11" fill={color} />
      <Path
        d="M7 12.5l3.5 3.5 6.5-7"
        stroke={C.white}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

function IconX({ size = 16, color = C.red }: { size?: number; color?: string }) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      <Circle cx="12" cy="12" r="11" fill={color} />
      <Path
        d="M8 8l8 8M16 8l-8 8"
        stroke={C.white}
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

function IconWarn({ size = 14, color = C.amber }: { size?: number; color?: string }) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      <Circle cx="12" cy="12" r="11" fill={color} />
      <Path d="M12 7v6M12 16v1" stroke={C.white} strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </Svg>
  );
}

function IconInfo({ size = 14, color = C.blue }: { size?: number; color?: string }) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      <Circle cx="12" cy="12" r="11" fill={color} />
      <Path d="M12 7v5M12 15v1" stroke={C.white} strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </Svg>
  );
}

function IconClipboard({ size = 11, color = C.blue }: { size?: number; color?: string }) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      <Rect x="4" y="3" width="16" height="18" rx="2" stroke={color} strokeWidth="2" fill="none" />
      <Rect x="8" y="1" width="8" height="4" rx="1" stroke={color} strokeWidth="2" fill={C.white} />
      <Path d="M9 10h6M9 13h4" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
  );
}


// ── Styles ────────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  coverPage: { backgroundColor: C.coverBlue1, flex: 1 },
  coverPageOverlay: { position: 'absolute', top: 0, right: 0, width: '60%', bottom: 0, backgroundColor: C.coverBlue2, opacity: 0.4 },
  coverCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 50 },
  coverLogo: { fontSize: 36, fontFamily: FONT_BOLD, color: C.white, marginBottom: 6 },
  coverBadge: { fontSize: 10, color: 'rgba(255,255,255,0.6)', letterSpacing: 3, marginBottom: 40 },
  coverTitle: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  coverUrl: { fontSize: 16, fontFamily: FONT_BOLD, color: C.white, textAlign: 'center', marginBottom: 40, maxWidth: 400 },
  coverScore: { fontSize: 96, fontFamily: FONT_BOLD, lineHeight: 1, marginBottom: 4 },
  coverScoreLabel: { fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 20 },
  coverRiskBadge: { padding: '6 20', borderRadius: 20, overflow: 'hidden', marginBottom: 60 },
  coverRiskText: { fontSize: 10, color: C.white, fontFamily: FONT_BOLD, letterSpacing: 1 },
  coverMeta: { flexDirection: 'row', marginTop: 40, gap: 30 },
  coverMetaItem: { alignItems: 'center' },
  coverMetaLabel: { fontSize: 8, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  coverMetaValue: { fontSize: 11, color: C.white, fontFamily: FONT_BOLD },
  coverMetaIconRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },

  page: { padding: 50, backgroundColor: C.white },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginTop: 30, marginBottom: 16 },
  sectionBar: { width: 5, height: 20, backgroundColor: C.blue, borderRadius: 3, marginRight: 10 },
  sectionTitle: { fontSize: 16, fontFamily: FONT_BOLD, color: C.text },

  card: { borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 18, marginBottom: 14 },
  cardGreen: { borderColor: C.green, backgroundColor: C.greenBg },
  cardRed: { borderColor: C.red, backgroundColor: C.redBg },
  cardAmber: { borderColor: C.amber, backgroundColor: C.amberBg },

  checkRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  checkBadge: { width: 36, alignItems: 'center', marginRight: 12, marginTop: 2 },
  checkBody: { flex: 1 },
  checkName: { fontSize: 13, fontFamily: FONT_BOLD, color: C.text, marginBottom: 4 },
  checkDetail: { fontSize: 12, color: C.muted, lineHeight: 1.6 },
  checkRec: { fontSize: 11.5, color: C.amberText, backgroundColor: C.amberBg, padding: '6 10', borderRadius: 6, marginTop: 6, lineHeight: 1.5 },
  checkArticle: { fontSize: 11, color: C.blue, marginTop: 6 },

  issueRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  issueBadge: { width: 36, alignItems: 'center', marginRight: 12, marginTop: 2 },
  issueBody: { flex: 1 },
  issueTitle: { fontSize: 13, fontFamily: FONT_BOLD, color: C.text, marginBottom: 4 },
  issueDesc: { fontSize: 12, color: C.muted, lineHeight: 1.6, marginBottom: 6 },
  issueFix: { fontSize: 11.5, color: '#166534', backgroundColor: C.greenBg, padding: '6 10', borderRadius: 6, lineHeight: 1.5 },
  issueArticle: { fontSize: 11, color: C.blue, marginTop: 6 },

  scoreBar: { flexDirection: 'row', marginVertical: 14, gap: 5 },
  scoreSeg: { flex: 1, height: 18, borderRadius: 4 },
  scoreLegend: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  scoreLegendText: { fontSize: 10, color: C.muted },

  // ── Remediation ─────────────────────────────────────────────────────────────
  remSectionHeader: { flexDirection: 'row', alignItems: 'center', marginTop: 32, marginBottom: 12 },
  remSectionBar: { width: 4, height: 20, backgroundColor: C.blue, borderRadius: 2, marginRight: 10 },
  remSectionTitle: { fontSize: 16, fontFamily: FONT_BOLD, color: C.text },
  remIntro: { fontSize: 11, color: C.muted, marginBottom: 20, lineHeight: 1.7 },
  remGrid: { gap: 12 },
  remCard: { backgroundColor: C.white, borderWidth: 1, borderColor: C.border, borderRadius: 12, borderLeftWidth: 4, padding: '16 18', marginBottom: 10 },
  remCardAi: { borderLeftColor: C.blue },
  remCardCheck: { borderLeftColor: C.amber },
  remCardNum: { fontSize: 10, fontFamily: FONT_BOLD, color: C.muted, marginBottom: 8 },
  remCardText: { fontSize: 12.5, color: C.text, lineHeight: 1.7 },
  remNote: { marginTop: 28, padding: 16, backgroundColor: '#f8fafc', borderRadius: 10, borderLeftWidth: 3, borderLeftColor: C.blue },
  remNoteText: { fontSize: 11, color: C.muted, lineHeight: 1.7 },

  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 0 },
  infoCell: { width: '50%', flexDirection: 'row', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: C.border },
  infoLabel: { width: 110, fontSize: 11, color: C.muted },
  infoValue: { flex: 1, fontSize: 11, color: C.text, fontFamily: FONT_BOLD },
  infoGreen: { color: C.green },
  infoRed: { color: C.red },

  gdprRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  gdprArt: { width: 60, fontSize: 11, fontFamily: FONT_BOLD, color: C.blue },
  gdprDesc: { flex: 1, fontSize: 11, color: C.muted },

  footer: { position: 'absolute', bottom: 25, left: 45, right: 45, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: C.border, paddingTop: 8 },
  footerText: { fontSize: 8, color: C.muted },
  footerRight: { fontSize: 8, color: C.muted, fontFamily: FONT_OBLIQUE },
  footerUrl: { fontSize: 7.5, color: C.muted },
  pageNumber: { position: 'absolute', bottom: 25, right: 45, fontSize: 8, color: C.muted },
  pageNumberCenter: { position: 'absolute', bottom: 25, left: 0, right: 0, textAlign: 'center', fontSize: 8, color: C.muted },
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function esc(text: string | undefined | null): string {
  if (!text) return '';
  return String(text).replace(/&/g, 'and').replace(/</g, '').replace(/>/g, '');
}

function sevColor(s: string): string {
  if (s === 'critical') return C.red;
  if (s === 'warning') return C.amber;
  return C.blue;
}

function artLabel(art: string | undefined): string {
  if (!art) return '';
  const map: Record<string, string> = {
    '5': 'Art. 5 — Principles', '6': 'Art. 6 — Lawfulness', '7': 'Art. 7 — Consent',
    '12': 'Art. 12 — Transparency', '13': 'Art. 13/14 — Info provision', '15': 'Art. 15 — Right of access',
    '16': 'Art. 16 — Rectification', '17': 'Art. 17 — Erasure', '20': 'Art. 20 — Portability',
    '21': 'Art. 21 — Objection', '22': 'Art. 22 — Automated decisions', '25': 'Art. 25 — Design',
    '28': 'Art. 28 — Processor', '30': 'Art. 30 — Records', '32': 'Art. 32 — Security',
    '33': 'Art. 33 — Breaches', '35': 'Art. 35 — DPIA', '44': 'Art. 44 — Transfers',
    '46': 'Art. 46 — Mechanisms',
  };
  return map[art] || `Art. ${art}`;
}

function scoreColorFn(score: number): string {
  if (score >= 75) return C.green;
  if (score >= 50) return C.amber;
  return C.red;
}

function scoreBarComponent(score: number) {
  const filled = Math.round(score / 10);
  const color = scoreColorFn(score);
  return (
    <View>
      <View style={S.scoreBar}>
        {Array.from({ length: 10 }).map((_, i) => (
          <View key={i} style={[S.scoreSeg, { backgroundColor: i < filled ? color : C.border }]} />
        ))}
      </View>
      <View style={S.scoreLegend}>
        <Text style={S.scoreLegendText}>0 Critical</Text>
        <Text style={S.scoreLegendText}>50 Partial</Text>
        <Text style={S.scoreLegendText}>100 Compliant</Text>
      </View>
    </View>
  );
}

// ── White-label options ─────────────────────────────────────────────────────────
export interface WhiteLabelOptions {
  companyName?: string;
  logoUrl?: string;
}

export interface GenerateReportPdfOptions {
  whiteLabel?: WhiteLabelOptions;
}

// ── Document ──────────────────────────────────────────────────────────────────
interface Props {
  url: string;
  result: any;
  whiteLabel?: WhiteLabelOptions;
}

function getBranding(whiteLabel?: WhiteLabelOptions) {
  if (whiteLabel?.companyName) {
    return {
      logoText: whiteLabel.companyName,
      footerText: `Generated by ${whiteLabel.companyName} — Compliance Report`,
      remNoteText: `After fixing the above issues, re-run the compliance scan at no additional cost to verify your remediation efforts.`,
    };
  }
  return {
    logoText: 'ComplyScan',
    footerText: 'Generated by ComplyScan — GDPR compliance made effortless',
    remNoteText: 'After fixing the above issues, re-run the ComplyScan GDPR compliance scan at no additional cost to verify your remediation efforts.',
  };
}

const ReportDocument: React.FC<Props> = ({ url, result, whiteLabel }) => {
  const branding = getBranding(whiteLabel);
  const { crawl, ruleChecks, aiAnalysis, scannedAt } = result;
  const score = aiAnalysis?.gdprScore ?? 0;
  const sc = scoreColorFn(score);
  const risk = (aiAnalysis?.riskLevel ?? 'unknown') as 'low' | 'medium' | 'high' | 'critical' | 'unknown';
  const riskLabelMap: Record<string, string> = {
    low: 'LOW RISK', medium: 'MEDIUM RISK', high: 'HIGH RISK',
    critical: 'CRITICAL RISK', unknown: 'UNKNOWN RISK',
  };
  const riskLabel = riskLabelMap[risk] || risk.toUpperCase();
  const passCount = ruleChecks?.filter((c: any) => c.passed).length ?? 0;
  const failCount = ruleChecks?.filter((c: any) => !c.passed).length ?? 0;
  const issueCount = aiAnalysis?.issues?.length ?? 0;
  const scanDate = new Date(scannedAt).toLocaleDateString('en-GB', {
    timeZone: 'Europe/Zurich', day: 'numeric', month: 'long', year: 'numeric',
  });

  const failedChecks = (ruleChecks || []).filter((c: any) => !c.passed);
  const passedChecks = (ruleChecks || []).filter((c: any) => c.passed);
  const issues = aiAnalysis?.issues || [];

  // Build numbered remediation list — failed checks first, then AI issues
  const remItems: Array<{ text: string; type: 'check' | 'ai' }> = [
    ...failedChecks.map((c: any) => ({ text: `${c.name} — ${c.recommendation || 'See recommendation above'}`, type: 'check' as const })),
    ...issues.filter((i: any) => i.fix).map((i: any) => ({ text: `${i.title} — ${i.fix}`, type: 'ai' as const })),
  ];

  // Compute total page count (cover = 1, then fixed pages + optional)
  const hasIssuesPage = issues.length > 0;
  const hasRemPage = remItems.length > 0;
  const totalPages =
    1 + // cover
    1 + // executive summary
    1 + // automated checks
    (hasIssuesPage ? 1 : 0) + // AI issues
    1 + // website analysis
    1 + // GDPR reference
    (hasRemPage ? 1 : 0); // remediation

  // Page counter: p increments for every <Page> rendered.
  // totalPages is the final document total so every page shows "N / TOTAL" correctly.
  let p = 0;

  return (
    <Document author="ComplyScan" title={`GDPR Report — ${url}`} subject="GDPR Compliance Report">
      {/* ── Cover Page ── */}
      <Page size="A4" style={S.coverPage}>
        <View style={S.coverPageOverlay} />
        <View style={S.coverCenter}>
          <Text style={S.coverLogo}>{branding.logoText}</Text>
          <Text style={S.coverBadge}>GDPR COMPLIANCE REPORT</Text>

          <Text style={[S.coverScore, { color: sc }]}>{score}</Text>
          <Text style={S.coverScoreLabel}>out of 100 — Compliance Score</Text>

          <View style={[S.coverRiskBadge, { backgroundColor: sc }]}>
            <Text style={S.coverRiskText}>{riskLabel}</Text>
          </View>

          <Text style={S.coverTitle}>Scanned Website</Text>
          <Text style={S.coverUrl}>{esc(url)}</Text>

          <View style={S.coverMeta}>
            <View style={S.coverMetaItem}>
              <Text style={S.coverMetaLabel}>Date</Text>
              <Text style={S.coverMetaValue}>{scanDate}</Text>
            </View>
            <View style={S.coverMetaItem}>
              <Text style={S.coverMetaLabel}>Automated Checks</Text>
              <View style={S.coverMetaIconRow}>
                <Text style={S.coverMetaValue}>{passCount}</Text>
                <Svg viewBox="0 0 24 24" width={12} height={12}>
                  <Circle cx="12" cy="12" r="11" fill={C.green} />
                  <Path d="M7 12.5l3.5 3.5 6.5-7" stroke={C.white} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </Svg>
                <Text style={[S.coverMetaValue, { marginLeft: 8 }]}>{failCount}</Text>
                <Svg viewBox="0 0 24 24" width={12} height={12}>
                  <Circle cx="12" cy="12" r="11" fill={C.red} />
                  <Path d="M8 8l8 8M16 8l-8 8" stroke={C.white} strokeWidth="2.5" strokeLinecap="round" fill="none" />
                </Svg>
              </View>
            </View>
            <View style={S.coverMetaItem}>
              <Text style={S.coverMetaLabel}>AI Findings</Text>
              <Text style={S.coverMetaValue}>{issueCount}</Text>
            </View>
          </View>
        </View>
        <View style={S.footer}>
          <View>
            <Text style={S.footerText}>{branding.footerText}</Text>
            <Text style={S.footerUrl}>{esc(url)}</Text>
          </View>
          <Text style={S.footerRight}>CONFIDENTIAL</Text>
        </View>
      </Page>

      {/* ── Page 2: Executive Summary ── */}
      <Page size="A4" style={S.page}>
        <View style={S.sectionHeader}>
          <View style={S.sectionBar} />
          <Text style={S.sectionTitle}>Executive Summary</Text>
        </View>

        <View style={[S.card, { backgroundColor: '#f8fafc' }]}>
          <View style={{ marginBottom: 12 }}>
            <Text style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Scanned Website</Text>
            <Text style={{ fontSize: 14, fontFamily: FONT_BOLD, color: C.blue }}>{esc(url)}</Text>
          </View>
          <Text style={{ fontSize: 12, color: C.muted, lineHeight: 1.7, marginBottom: 10 }}>
            This automated GDPR compliance scan was conducted on {scanDate}.
            The scan combines rule-based automated checks with AI-powered analysis.
          </Text>
          <Text style={{ fontSize: 12, color: C.muted, lineHeight: 1.7, marginBottom: 10 }}>
            Overall compliance score:{' '}
            <Text style={{ fontFamily: FONT_BOLD, color: sc }}>{score}/100</Text> — classified as{' '}
            <Text style={{ fontFamily: FONT_BOLD, color: sc }}>{riskLabel}</Text>.
          </Text>
          <Text style={{ fontSize: 12, color: C.muted, lineHeight: 1.7 }}>
            {ruleChecks?.length || 0} automated checks performed:{' '}
            <Text style={{ color: C.green }}>{passCount} passed</Text>,{' '}
            <Text style={{ color: C.red }}>{failCount} failed</Text>.{' '}
            {issueCount} additional AI-detected findings.
          </Text>
        </View>

        <View style={S.sectionHeader}>
          <View style={S.sectionBar} />
          <Text style={S.sectionTitle}>Compliance Score Breakdown</Text>
        </View>

        <View style={[S.card]}>
          {scoreBarComponent(score)}
          <Text style={{ fontSize: 11, color: C.muted, marginTop: 10, lineHeight: 1.6 }}>
            {score >= 75
              ? 'Good standing. Your website demonstrates reasonable GDPR compliance. Address the flagged items to reach full compliance.'
              : score >= 50
              ? 'Partial compliance. Several issues require attention. Prioritise the critical and high-severity findings below.'
              : 'Significant compliance gaps. Immediate action is recommended. Critical issues are likely exposing your business to regulatory risk.'}
          </Text>
        </View>

        {aiAnalysis?.summary && (
          <>
            <View style={S.sectionHeader}>
              <View style={S.sectionBar} />
              <Text style={S.sectionTitle}>AI Assessment</Text>
            </View>
            <View style={[S.card, { backgroundColor: '#f8fafc' }]}>
              <Text style={{ fontSize: 12, color: C.muted, lineHeight: 1.7 }}>{esc(aiAnalysis.summary)}</Text>
            </View>
          </>
        )}

        <Text style={S.pageNumber}>{++p} / {totalPages}</Text>
        <View style={S.footer}>
          <View>
            <Text style={S.footerText}>{branding.footerText}</Text>
            <Text style={S.footerUrl}>{esc(url)}</Text>
          </View>
          <Text style={S.footerRight}>{scanDate}</Text>
        </View>
      </Page>

      {/* ── Page 3: Automated Checks ── */}
      <Page size="A4" style={S.page}>
        <View style={S.sectionHeader}>
          <View style={S.sectionBar} />
          <Text style={S.sectionTitle}>Automated GDPR Checks</Text>
        </View>

        <View style={{ flexDirection: 'row', marginBottom: 14, gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <IconCheck size={16} color={C.green} />
            <Text style={{ fontSize: 12, fontFamily: FONT_BOLD, color: C.green }}>{passCount} Passed</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <IconX size={16} color={C.red} />
            <Text style={{ fontSize: 12, fontFamily: FONT_BOLD, color: C.red }}>{failCount} Failed</Text>
          </View>
        </View>

        {failedChecks.length > 0 && (
          <>
            <Text style={{ fontSize: 10, color: C.red, fontFamily: FONT_BOLD, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
              Failed Checks
            </Text>
            {failedChecks.map((check: any, i: number) => (
              <View key={i} style={[S.card, S.cardRed]}>
                <View style={S.checkRow}>
                  <View style={S.checkBadge}>
                    <IconX size={20} color={C.red} />
                  </View>
                  <View style={S.checkBody}>
                    <Text style={S.checkName}>{esc(check.name)}</Text>
                    <Text style={S.checkDetail}>{esc(check.detail || '')}</Text>
                    {check.recommendation && (
                      <Text style={S.checkRec}>Recommendation: {esc(check.recommendation)}</Text>
                    )}
                    {check.gdprArticle && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 }}>
                        <IconClipboard size={10} color={C.blue} />
                        <Text style={S.checkArticle}>{artLabel(check.gdprArticle)}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            ))}
          </>
        )}

        {passedChecks.length > 0 && (
          <>
            <Text style={{ fontSize: 10, color: C.green, fontFamily: FONT_BOLD, marginTop: 18, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
              Passed Checks
            </Text>
            {passedChecks.map((check: any, i: number) => (
              <View key={i} style={[S.card, S.cardGreen]}>
                <View style={S.checkRow}>
                  <View style={S.checkBadge}>
                    <IconCheck size={20} color={C.green} />
                  </View>
                  <View style={S.checkBody}>
                    <Text style={S.checkName}>{esc(check.name)}</Text>
                    <Text style={S.checkDetail}>{esc(check.detail || 'Passed')}</Text>
                    {check.gdprArticle && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 }}>
                        <IconClipboard size={10} color={C.blue} />
                        <Text style={S.checkArticle}>{artLabel(check.gdprArticle)}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            ))}
          </>
        )}

        <Text style={S.pageNumber}>{++p} / {totalPages}</Text>
        <View style={S.footer}>
          <Text style={S.footerText}>{branding.footerText}</Text>
          <Text style={S.footerRight}>{scanDate}</Text>
        </View>
      </Page>

      {/* ── Page 4: AI Issues ── */}
      {hasIssuesPage && (
        <Page size="A4" style={S.page}>
          <View style={S.sectionHeader}>
            <View style={S.sectionBar} />
            <Text style={S.sectionTitle}>AI-Detected Issues ({issueCount} Findings)</Text>
          </View>

          {issues.map((issue: any, i: number) => (
            <View key={i} style={[S.card, { borderColor: sevColor(issue.severity), borderLeftWidth: 3 }]}>
              <View style={S.issueRow}>
                <View style={S.issueBadge}>
                  {issue.severity === 'critical' ? (
                    <IconX size={20} color={C.red} />
                  ) : issue.severity === 'warning' ? (
                    <IconWarn size={20} color={C.amber} />
                  ) : (
                    <IconInfo size={20} color={C.blue} />
                  )}
                </View>
                <View style={S.issueBody}>
                  <Text style={S.issueTitle}>{esc(issue.title)}</Text>
                  <Text style={S.issueDesc}>{esc(issue.description)}</Text>
                  {issue.fix && (
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 4, marginTop: 4 }}>
                      <IconCheck size={10} color={C.green} />
                      <Text style={[S.issueFix, { flex: 1 }]}>Recommended Fix: {esc(issue.fix)}</Text>
                    </View>
                  )}
                  {issue.gdprArticle && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 }}>
                      <IconClipboard size={10} color={C.blue} />
                      <Text style={S.issueArticle}>{artLabel(issue.gdprArticle)}</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          ))}

          <Text style={S.pageNumber}>{++p} / {totalPages}</Text>
          <View style={S.footer}>
            <View>
              <Text style={S.footerText}>{branding.footerText}</Text>
              <Text style={S.footerUrl}>{esc(url)}</Text>
            </View>
            <Text style={S.footerRight}>{scanDate}</Text>
          </View>
        </Page>
      )}

      {/* ── Page 5: Website Analysis ── */}
      <Page size="A4" style={S.page}>
        <View style={S.sectionHeader}>
          <View style={S.sectionBar} />
          <Text style={S.sectionTitle}>Website Analysis</Text>
        </View>

        <View style={[S.card]}>
          <Text style={{ fontSize: 12, fontFamily: FONT_BOLD, color: C.text, marginBottom: 12 }}>General Information</Text>
          <View style={S.infoGrid}>
            <View style={S.infoCell}>
              <Text style={S.infoLabel}>Website URL</Text>
              <Text style={[S.infoValue, { color: C.blue }]}>{esc(url)}</Text>
            </View>
            <View style={S.infoCell}>
              <Text style={S.infoLabel}>Website Title</Text>
              <Text style={S.infoValue}>{esc(crawl?.title || 'N/A')}</Text>
            </View>
            <View style={S.infoCell}>
              <Text style={S.infoLabel}>HTTPS</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                {crawl?.hasSSL ? (
                  <IconCheck size={11} color={C.green} />
                ) : (
                  <IconX size={11} color={C.red} />
                )}
                <Text style={[S.infoValue, crawl?.hasSSL ? S.infoGreen : S.infoRed]}>
                  {crawl?.hasSSL ? 'Enabled' : 'Not enabled'}
                </Text>
              </View>
            </View>
            <View style={S.infoCell}>
              <Text style={S.infoLabel}>HTTP Status</Text>
              <Text style={S.infoValue}>{crawl?.statusCode || 'N/A'}</Text>
            </View>
            <View style={S.infoCell}>
              <Text style={S.infoLabel}>Forms Found</Text>
              <Text style={S.infoValue}>{crawl?.formsCount ?? 0}</Text>
            </View>
            <View style={S.infoCell}>
              <Text style={S.infoLabel}>Labeled Inputs</Text>
              <Text style={S.infoValue}>{crawl?.formInputsLabeled ?? 0} / {crawl?.totalFormInputs ?? 0}</Text>
            </View>
          </View>
        </View>

        <View style={[S.card, { marginTop: 12 }]}>
          <Text style={{ fontSize: 12, fontFamily: FONT_BOLD, color: C.text, marginBottom: 12 }}>Privacy & Cookie Policies</Text>
          <View style={S.infoGrid}>
            <View style={S.infoCell}>
              <Text style={S.infoLabel}>Privacy Policy</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                {crawl?.hasPrivacyPolicy ? (
                  <IconCheck size={11} color={C.green} />
                ) : (
                  <IconX size={11} color={C.red} />
                )}
                <Text style={[S.infoValue, crawl?.hasPrivacyPolicy ? S.infoGreen : S.infoRed]}>
                  {crawl?.hasPrivacyPolicy ? 'Found' : 'Missing'}
                </Text>
              </View>
            </View>
            <View style={S.infoCell}>
              <Text style={S.infoLabel}>Cookie Policy</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                {crawl?.hasCookiePolicyPage ? (
                  <IconCheck size={11} color={C.green} />
                ) : (
                  <IconWarn size={11} color={C.amber} />
                )}
                <Text style={[S.infoValue, crawl?.hasCookiePolicyPage ? S.infoGreen : { color: C.amber }]}>
                  {crawl?.hasCookiePolicyPage ? 'Found' : 'Not detected'}
                </Text>
              </View>
            </View>
            <View style={S.infoCell}>
              <Text style={S.infoLabel}>Cookie Banner</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                {crawl?.hasCookieBanner ? (
                  <IconCheck size={11} color={C.green} />
                ) : (
                  <IconWarn size={11} color={C.amber} />
                )}
                <Text style={[S.infoValue, crawl?.hasCookieBanner ? S.infoGreen : { color: C.amber }]}>
                  {crawl?.hasCookieBanner ? 'Detected' : 'Not detected'}
                </Text>
              </View>
            </View>
            <View style={S.infoCell}>
              <Text style={S.infoLabel}>SSL/TLS</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                {crawl?.hasSSL ? (
                  <IconCheck size={11} color={C.green} />
                ) : (
                  <IconX size={11} color={C.red} />
                )}
                <Text style={[S.infoValue, crawl?.hasSSL ? S.infoGreen : S.infoRed]}>
                  {crawl?.hasSSL ? 'Active' : 'Inactive'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {(crawl?.trackingScripts?.length ?? 0) > 0 && (
          <View style={[S.card, { marginTop: 12 }]}>
            <Text style={{ fontSize: 12, fontFamily: FONT_BOLD, color: C.text, marginBottom: 10 }}>Tracking Scripts Detected</Text>
            <Text style={{ fontSize: 11, color: C.muted }}>{(crawl?.trackingScripts ?? []).join(' · ')}</Text>
          </View>
        )}

        {(crawl?.thirdPartyEmbeds?.length ?? 0) > 0 && (
          <View style={[S.card, { marginTop: 12 }]}>
            <Text style={{ fontSize: 12, fontFamily: FONT_BOLD, color: C.text, marginBottom: 10 }}>Third-Party Embeds</Text>
            <Text style={{ fontSize: 11, color: C.muted }}>{(crawl?.thirdPartyEmbeds ?? []).join(' · ')}</Text>
          </View>
        )}

        <Text style={S.pageNumber}>{++p} / {totalPages}</Text>
        <View style={S.footer}>
          <View>
            <Text style={S.footerText}>{branding.footerText}</Text>
            <Text style={S.footerUrl}>{esc(url)}</Text>
          </View>
          <Text style={S.footerRight}>{scanDate}</Text>
        </View>
      </Page>

      {/* ── Page 6: GDPR Reference ── */}
      <Page size="A4" style={S.page}>
        <View style={S.sectionHeader}>
          <View style={S.sectionBar} />
          <Text style={S.sectionTitle}>GDPR Articles Quick Reference</Text>
        </View>

        <View style={[S.card, { backgroundColor: '#f8fafc' }]}>
          {[
            ['Art. 5', 'Principles of processing'],
            ['Art. 6', 'Lawfulness of processing'],
            ['Art. 7', 'Conditions for consent'],
            ['Art. 12', 'Transparent information'],
            ['Art. 13/14', 'Information provision'],
            ['Art. 15', 'Right of access by data subject'],
            ['Art. 16', 'Right to rectification'],
            ['Art. 17', 'Right to erasure (right to be forgotten)'],
            ['Art. 18', 'Restriction of processing'],
            ['Art. 20', 'Right to data portability'],
            ['Art. 21', 'Right to object'],
            ['Art. 22', 'Automated decision-making'],
            ['Art. 25', 'Data protection by design & by default'],
            ['Art. 28', 'Processor obligations'],
            ['Art. 30', 'Records of processing activities'],
            ['Art. 32', 'Security of processing'],
            ['Art. 33', 'Breach notification (72h)'],
            ['Art. 35', 'Data Protection Impact Assessment'],
            ['Art. 44-49', 'International data transfers'],
          ].map(([art, desc]) => (
            <View key={art} style={S.gdprRow}>
              <Text style={S.gdprArt}>{art}</Text>
              <Text style={S.gdprDesc}>{desc}</Text>
            </View>
          ))}
        </View>

        <Text style={S.pageNumber}>{++p} / {totalPages}</Text>
        <View style={S.footer}>
          <View>
            <Text style={S.footerText}>{branding.footerText}</Text>
            <Text style={S.footerUrl}>{esc(url)}</Text>
          </View>
          <Text style={S.footerRight}>{scanDate}</Text>
        </View>
      </Page>

      {/* ── Page 7: Remediation Plan (2-col grid) ── */}
      {hasRemPage && (
        <Page size="A4" style={S.page}>
          <View style={S.remSectionHeader}>
            <View style={S.remSectionBar} />
            <Text style={S.remSectionTitle}>Remediation Action Plan</Text>
          </View>

          <Text style={S.remIntro}>
            {remItems.length} action{remItems.length !== 1 ? 's' : ''} required — address in priority order.
            Re-scan at no extra cost to verify compliance after fixes are applied.
          </Text>

          <View style={S.remGrid}>
            {remItems.map((item, i) => (
              <View
                key={i}
                style={[
                  S.remCard,
                  item.type === 'ai' ? S.remCardAi : S.remCardCheck,
                ]}
              >
                <Text style={S.remCardNum}>{String(i + 1).padStart(2, '0')}</Text>
                <Text style={S.remCardText}>{esc(item.text)}</Text>
              </View>
            ))}
          </View>

          <View style={S.remNote}>
            <Text style={S.remNoteText}>
              {branding.remNoteText}
            </Text>
          </View>

          {/* URL repeated at end of report */}
          <View style={{ marginTop: 20, padding: '10 14', backgroundColor: '#f8fafc', borderRadius: 8 }}>
            <Text style={{ fontSize: 8.5, color: C.muted }}>Report generated for:</Text>
            <Text style={{ fontSize: 10, fontFamily: FONT_BOLD, color: C.blue, marginTop: 2 }}>{esc(url)}</Text>
          </View>

          <Text style={S.pageNumber}>{++p} / {totalPages}</Text>
          <View style={S.footer}>
            <View>
              <Text style={S.footerText}>{branding.footerText}</Text>
              <Text style={S.footerUrl}>{esc(url)}</Text>
            </View>
            <Text style={S.footerRight}>{scanDate}</Text>
          </View>
        </Page>
      )}
    </Document>
  );
};

export { ReportDocument };
export type { Props as ReportDocumentProps };

export async function generateReportPdfBuffer(url: string, result: any, options?: GenerateReportPdfOptions): Promise<Buffer> {
  const doc = <ReportDocument url={url} result={result} whiteLabel={options?.whiteLabel} />;
  const blob = await pdf(doc).toBlob();
  const arrayBuffer = await blob.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
