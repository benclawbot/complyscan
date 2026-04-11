import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Cookie Policy | ComplyScan",
  description:
    "Cookie Policy for ComplyScan — details on strictly necessary cookies, consent choices, retention, and how to withdraw consent.",
};

export default function CookiePolicyPage() {
  return (
    <main className="min-h-screen bg-midnight text-white">
      <header className="border-b border-white/10">
        <div className="max-w-3xl mx-auto px-4 py-6 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold" style={{ fontFamily: "var(--font-space-grotesk)" }}>
            ComplyScan
          </Link>
          <Link href="/" className="text-sm text-white/60 hover:text-white transition-colors">
            Back to home
          </Link>
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-4 py-12 space-y-8">
        <h1 className="text-3xl md:text-4xl font-bold" style={{ fontFamily: "var(--font-space-grotesk)" }}>
          Cookie Policy
        </h1>
        <p className="text-white/50 text-sm">Last updated: April 11, 2026</p>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">1. What cookies we use</h2>
          <p>ComplyScan uses:</p>
          <ul className="list-disc pl-6 space-y-2 text-white/90">
            <li><strong>Strictly necessary cookies</strong> for authentication and security.</li>
            <li><strong>Consent preference cookie</strong> to remember whether you accepted or rejected optional cookies.</li>
            <li><strong>Optional analytics cookies</strong> only after explicit opt-in.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">2. Legal basis</h2>
          <p>
            Strictly necessary cookies are processed under legitimate interest to provide secure service operation.
            Optional analytics cookies are processed only on consent (GDPR Article 6(1)(a)).
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">3. Retention</h2>
          <ul className="list-disc pl-6 space-y-2 text-white/90">
            <li>Session/auth cookie: up to 24 hours inactivity or logout.</li>
            <li>Cookie consent cookie: up to 12 months.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">4. Withdraw consent</h2>
          <p>
            You can withdraw consent at any time by rejecting optional cookies in the cookie banner settings or by clearing cookies in your browser.
            If you need assistance, contact <a className="text-accent-blue hover:underline" href="mailto:privacy@complyscan.com">privacy@complyscan.com</a>.
          </p>
        </section>
      </article>
    </main>
  );
}
