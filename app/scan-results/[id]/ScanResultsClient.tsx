"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle, XCircle, AlertTriangle, FileText, RefreshCw, Lock } from "lucide-react";

interface Props {
  scanId: string;
  url: string;
  email: string | null;
  status: string;
  result: any;
  isLimitedPreview?: boolean;
}

function ScoreCard({ score }: { score: number }) {
  const color = score >= 80 ? "text-green-400" : score >= 60 ? "text-yellow-400" : "text-red-400";
  const label = score >= 80 ? "Good" : score >= 60 ? "Needs Work" : "Critical";

  return (
    <div className="bg-midnight-light border border-white/10 rounded-2xl p-8 text-center">
      <div className={`text-6xl font-bold font-heading ${color} mb-2`}>{score}</div>
      <div className="text-white/40 text-sm uppercase tracking-wider">GDPR Score</div>
      <div className={`text-sm font-medium mt-2 ${color}`}>{label}</div>
    </div>
  );
}

function IssueList({ issues, severity, isLimited }: { issues: any[]; severity: "critical" | "warning" | "info"; isLimited?: boolean }) {
  const icons = { critical: XCircle, warning: AlertTriangle, info: CheckCircle };
  const colors = {
    critical: "border-red-500/30 bg-red-500/5",
    warning: "border-yellow-500/30 bg-yellow-500/5",
    info: "border-blue-500/30 bg-blue-500/5",
  };
  const iconColors = {
    critical: "text-red-400",
    warning: "text-yellow-400",
    info: "text-blue-400",
  };
  const Icon = icons[severity];
  const displayed = isLimited ? issues.slice(0, 5) : issues;
  const hidden = issues.length - displayed.length;

  if (!issues.length) return null;

  return (
    <div className={`rounded-xl border p-4 ${colors[severity]}`}>
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`w-4 h-4 ${iconColors[severity]}`} />
        <span className="font-semibold text-white capitalize">{severity} Issues</span>
        <span className="text-white/30 text-xs">({issues.length})</span>
        {isLimited && hidden > 0 && <span className="text-amber-400 text-xs ml-auto">+{hidden} more</span>}
      </div>
      <ul className="space-y-2">
        {displayed.map((issue: any, i: number) => (
          <li key={i} className="text-sm text-white/70 flex items-start gap-2">
            <span className="text-white/30 mt-0.5 shrink-0">—</span>
            <div>
              <span className="text-white font-medium">{issue.rule}: </span>
              {issue.message}
              {!isLimited && issue.fix && (
                <div className="mt-1 text-xs text-white/40 bg-white/5 rounded px-2 py-1">Fix: {issue.fix}</div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function normalizeIssue(c: any) {
  return {
    rule: c.name || c.id || "Unknown",
    message: c.detail || c.description || "",
    fix: c.recommendation || "",
  };
}

function FindingsSection({ result, isLimitedPreview }: { result: any; isLimitedPreview?: boolean }) {
  const all = result.ruleChecks || [];
  const critical = all.filter((c: any) => c.severity === "critical" || c.severity === "error").map(normalizeIssue);
  const warnings = all.filter((c: any) => c.severity === "warning" || c.passed === false).map(normalizeIssue);
  const passed = all.filter((c: any) => c.severity === "pass" || c.severity === "info" || c.passed === true).map(normalizeIssue);

  const score = result.aiAnalysis?.gdprScore != null
    ? result.aiAnalysis.gdprScore
    : result.ruleChecks?.length
      ? Math.max(0, 100 - critical.length * 25 - warnings.length * 10)
      : null;

  return (
    <div className="space-y-6">
      {score !== null && <ScoreCard score={score} />}
      {critical.length > 0 && <IssueList issues={critical} severity="critical" isLimited={isLimitedPreview} />}
      {warnings.length > 0 && <IssueList issues={warnings} severity="warning" isLimited={isLimitedPreview} />}
      {passed.length > 0 && <IssueList issues={passed} severity="info" isLimited={isLimitedPreview} />}

      {!isLimitedPreview && result.aiAnalysis && (
        <div className="bg-midnight-light border border-white/10 rounded-xl p-6">
          <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-accent-blue" />
            AI Analysis
          </h3>
          <p className="text-white/60 text-sm whitespace-pre-wrap">
            {result.aiAnalysis.summary || result.aiAnalysis.text || "No summary available."}
          </p>
        </div>
      )}
    </div>
  );
}

function toLimitedPreview(result: any): any {
  if (!result) return result;
  const ISSUE_CAP = 5;
  const stripIssue = (issue: any) => ({
    ...issue,
    recommendation: undefined,
    fix: undefined,
  });

  return {
    ...result,
    ruleChecks: (result.ruleChecks || []).slice(0, ISSUE_CAP).map(stripIssue),
    aiAnalysis: null,
  };
}

export default function ScanResultsClient({ scanId, url: initialUrl, email: initialEmail, status: initialStatus, result: initialResult, isLimitedPreview }: Props) {
  const [status, setStatus] = useState(initialStatus || "loading");
  const [result, setResult] = useState(initialResult ? toLimitedPreview(initialResult) : null);
  const [url, setUrl] = useState(initialUrl || "");
  const [email, setEmail] = useState(initialEmail || null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [accountEmail, setAccountEmail] = useState(initialEmail || "");
  const [accountPassword, setAccountPassword] = useState("");
  const [accountError, setAccountError] = useState("");
  const [accountLoading, setAccountLoading] = useState(false);
  const [accountSuccess, setAccountSuccess] = useState(false);

  useEffect(() => {
    if (initialResult) return;

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 60;

    const poll = async () => {
      try {
        const res = await fetch(`/api/scan/${encodeURIComponent(scanId)}`);
        const data = await res.json() as { status?: string; url?: string; email?: string | null; result?: any };
        if (cancelled) return;

        if (!res.ok) {
          setStatus("failed");
          return;
        }

        setStatus(data.status || "loading");
        setUrl(data.url || "");
        setEmail(data.email || null);
        if (data.result) {
          setResult(toLimitedPreview(data.result));
          setStatus("completed");
          return;
        }

        attempts += 1;
        if (attempts < maxAttempts) {
          window.setTimeout(poll, 2000);
        } else {
          setStatus("failed");
        }
      } catch {
        if (cancelled) return;
        attempts += 1;
        if (attempts < maxAttempts) {
          window.setTimeout(poll, 2000);
        } else {
          setStatus("failed");
        }
      }
    };

    poll();
    return () => {
      cancelled = true;
    };
  }, [initialResult, scanId]);

  const handlePurchasePDF = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, email, plan: 'pdf', scanId }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'Failed to start checkout. Please try again.');
      }
    } catch {
      alert('Failed to start checkout. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccountError("");
    setAccountLoading(true);
    try {
      const res = await fetch('/api/auth/claim-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: accountEmail, password: accountPassword, scanId }),
      });
      const data = await res.json() as { error?: string; token?: string };
      if (!res.ok) {
        setAccountError(data.error || 'Failed to create account.');
        return;
      }
      setAccountSuccess(true);
      setTimeout(() => {
        window.location.href = `/dashboard?token=${encodeURIComponent(data.token || '')}`;
      }, 1200);
    } catch {
      setAccountError('Network error. Please try again.');
    } finally {
      setAccountLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-midnight">
      <header className="border-b border-white/10 bg-midnight-light">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="font-heading text-xl font-bold text-white hover:text-accent-glow transition-colors">
            ComplyScan
          </Link>
          <Link href="/login" className="text-sm text-white/50 hover:text-white/70 transition-colors">
            Dashboard →
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-10">
        {isLimitedPreview && status === "completed" && (
          <div className="mb-6 bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 text-sm text-amber-200 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
            <span>
              <strong>Free preview.</strong> Showing top issues only. <button onClick={() => setShowUpgradeModal(true)} className="underline hover:no-underline font-medium">Upgrade</button> to unlock fixes, AI analysis, and the PDF.
            </span>
          </div>
        )}

        {(status === "loading" || status === "pending" || status === "processing") && (
          <div className="text-center py-20">
            <div className="inline-flex items-center gap-3 text-white/60">
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span>Scan in progress — this page updates automatically...</span>
            </div>
          </div>
        )}

        {status === "failed" && (
          <div className="text-center py-20">
            <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white mb-2">Scan Failed</h1>
            <p className="text-white/60 mb-6">We couldn't scan this website. It may be down or blocking our crawler.</p>
            <Link href="/" className="px-6 py-3 bg-accent-blue text-white rounded-lg font-medium hover:bg-accent-glow transition-all">Try another URL</Link>
          </div>
        )}

        {status === "completed" && result && (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 bg-midnight-light border border-white/10 rounded-2xl p-6">
              <div>
                <h1 className="text-2xl font-bold text-white mb-1">GDPR Compliance Report</h1>
                <p className="text-white/40 text-sm">{url}</p>
                {email && <p className="text-white/30 text-xs mt-1">Email: {email}</p>}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowUpgradeModal(true)} className="rounded-lg bg-accent-blue px-5 py-2.5 font-semibold text-white hover:bg-accent-glow transition-all text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Get Full PDF Report
                </button>
                <Link href="/" className="rounded-lg bg-white/10 px-5 py-2.5 font-semibold text-white hover:bg-white/20 transition-all text-sm">Scan Another</Link>
              </div>
            </div>

            {!accountSuccess && (
              <div className="mb-6 bg-gradient-to-r from-accent-blue/10 via-midnight-light to-midnight-light border border-accent-blue/20 rounded-2xl p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="text-white font-semibold mb-1">Save your scan results</p>
                    <p className="text-white/50 text-sm">Create a free account to access your reports anytime and track compliance over time.</p>
                  </div>
                  <button onClick={() => setShowAccountModal(true)} className="rounded-lg bg-accent-blue px-5 py-2.5 font-semibold text-white hover:bg-accent-glow transition-all text-sm shrink-0">Create Free Account</button>
                </div>
              </div>
            )}

            <div className="mb-8">
              <h2 className="text-xl font-semibold text-white mb-4">Key Findings</h2>
              <FindingsSection result={result} isLimitedPreview={isLimitedPreview} />
            </div>

            <div className="bg-gradient-to-r from-accent-blue/20 via-midnight-light to-midnight-light border border-accent-blue/30 rounded-2xl p-8 text-center">
              <Lock className="w-8 h-8 text-accent-blue mx-auto mb-3" />
              <h3 className="text-xl font-bold text-white mb-2">Unlock the Full Report</h3>
              <p className="text-white/50 text-sm mb-6 max-w-md mx-auto">
                Get the complete PDF report with detailed fixes, executive summary, and AI analysis for <span className="text-white font-semibold">$29</span>.
              </p>
              <button onClick={handlePurchasePDF} disabled={loading} className="rounded-lg bg-accent-blue px-8 py-3 font-semibold text-white hover:bg-accent-glow transition-all shadow-lg shadow-accent-blue/30 disabled:opacity-50 disabled:cursor-not-allowed">
                {loading ? "Redirecting..." : "Get PDF Report — $29"}
              </button>
              <p className="text-white/30 text-xs mt-3">Secure payment via Stripe · Instant delivery</p>
            </div>
          </>
        )}
      </main>

      {showUpgradeModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setShowUpgradeModal(false)}>
          <div className="bg-midnight-light border border-white/20 rounded-2xl p-8 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <Lock className="w-8 h-8 text-accent-blue mx-auto mb-3" />
            <h3 className="text-xl font-bold text-white mb-2 text-center">Unlock Full PDF Report</h3>
            <p className="text-white/50 text-sm mb-6 text-center">Complete report with legal references, detailed fix guides, and executive summary for $29.</p>
            <button onClick={handlePurchasePDF} disabled={loading} className="w-full rounded-lg bg-accent-blue py-3 font-semibold text-white hover:bg-accent-glow transition-all disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? "Redirecting..." : "Continue to Payment — $29"}
            </button>
            <button onClick={() => setShowUpgradeModal(false)} className="w-full mt-3 text-center text-white/30 text-sm hover:text-white/60 transition-colors">Maybe later</button>
          </div>
        </div>
      )}

      {showAccountModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setShowAccountModal(false)}>
          <div className="bg-midnight-light border border-white/20 rounded-2xl p-8 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-white mb-2 text-center">Save Your Scan Results</h3>
            <p className="text-white/50 text-sm mb-6 text-center">Create a free account to access your report and all future scans.</p>

            {accountSuccess ? (
              <div className="text-center">
                <div className="w-12 h-12 bg-success/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-6 h-6 text-success" />
                </div>
                <p className="text-white font-semibold mb-1">Account created!</p>
                <p className="text-white/50 text-sm">Redirecting to your dashboard...</p>
              </div>
            ) : (
              <form onSubmit={handleCreateAccount} className="space-y-4">
                <div>
                  <label className="block text-white/50 text-xs mb-1 uppercase tracking-wider">Email</label>
                  <input type="email" value={accountEmail} onChange={e => setAccountEmail(e.target.value)} required className="w-full rounded-lg bg-midnight border border-white/20 px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-accent-blue transition-all" placeholder="your@email.com" />
                </div>
                <div>
                  <label className="block text-white/50 text-xs mb-1 uppercase tracking-wider">Password</label>
                  <input type="password" value={accountPassword} onChange={e => setAccountPassword(e.target.value)} required minLength={8} className="w-full rounded-lg bg-midnight border border-white/20 px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-accent-blue transition-all" placeholder="Min. 8 characters" />
                </div>
                {accountError && <p className="text-red-400 text-sm">{accountError}</p>}
                <button type="submit" disabled={accountLoading} className="w-full rounded-lg bg-accent-blue py-3 font-semibold text-white hover:bg-accent-glow transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                  {accountLoading ? "Creating account..." : "Create Free Account"}
                </button>
                <p className="text-center text-white/30 text-xs">Already have an account? <Link href="/login" className="text-accent-blue hover:text-accent-glow transition-colors">Sign in</Link></p>
              </form>
            )}
            <button onClick={() => setShowAccountModal(false)} className="w-full mt-3 text-center text-white/30 text-sm hover:text-white/60 transition-colors">{accountSuccess ? "Close" : "Maybe later"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
