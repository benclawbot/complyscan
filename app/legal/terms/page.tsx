import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service | ComplyScan",
  description:
    "Terms of Service for ComplyScan — GDPR compliance scanning tool. Learn about our service, payment terms, and acceptable use.",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-midnight text-white">
      <header className="border-b border-white/10">
        <div className="max-w-3xl mx-auto px-4 py-6 flex items-center justify-between">
          <Link
            href="/"
            className="text-xl font-bold"
            style={{ fontFamily: "var(--font-space-grotesk)" }}
          >
            ComplyScan
          </Link>
          <Link
            href="/"
            className="text-sm text-white/60 hover:text-white transition-colors"
          >
              Back to home
          </Link>
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-4 py-12">
        <h1
          className="text-3xl md:text-4xl font-bold mb-8"
          style={{ fontFamily: "var(--font-space-grotesk)" }}
        >
          Terms of Service
        </h1>
        <p className="text-white/50 text-sm mb-8">Last updated: March 30, 2026</p>

        <div className="prose prose-invert prose-lg max-w-none space-y-8">
          <section>
            <h2
              className="text-xl font-bold mb-3"
              style={{ fontFamily: "var(--font-space-grotesk)" }}
            >
              1. About ComplyScan
            </h2>
            <p>
              ComplyScan is an automated GDPR compliance scanning tool. When you submit
              a URL, our system crawls the website, analyses it against GDPR requirements,
              and delivers a compliance report. The service is designed to help website
              owners identify potential compliance gaps—it does not constitute legal advice.
            </p>
            <p>
              By using ComplyScan, you acknowledge that GDPR compliance is complex, fact-specific,
              and varies by jurisdiction. Our reports are one input into your compliance
              process, not a substitute for legal counsel.
            </p>
          </section>

          <section>
            <h2
              className="text-xl font-bold mb-3"
              style={{ fontFamily: "var(--font-space-grotesk)" }}
            >
              2. Service Description
            </h2>
            <p>
              ComplyScan performs an automated analysis of publicly accessible web pages. The scan
              checks for the presence or absence of certain elements (cookie consent banners,
              privacy policy links, SSL certificates, tracking scripts) and cross-references
              them against a set of GDPR requirements.
            </p>
            <p>
              Scan results are delivered as a structured report via email and/or web interface.
              Reports include an overall compliance score, individual findings with severity
              ratings, and general recommendations for remediation.
            </p>
          </section>

          <section>
            <h2
              className="text-xl font-bold mb-3"
              style={{ fontFamily: "var(--font-space-grotesk)" }}
            >
              3. Pricing and Payment
            </h2>
            <p>ComplyScan offers the following payment options:</p>
            <ul>
              <li><strong>Report Pack (3 credits):</strong> $29 USD, one-time payment.</li>
              <li><strong>Report Pack (10 credits):</strong> $79 USD, one-time payment.</li>
              <li><strong>Agency Subscription:</strong> $99 USD per month for agency dashboard access, client management, and unlimited subscriber scans while active.</li>
            </ul>
            <p>
              Payments are processed securely via Stripe. All prices are listed in USD and
              are exclusive of any applicable taxes. You are responsible for any taxes
              applicable to your jurisdiction.
            </p>
            <p>
              Agency subscription payments are billed monthly on the same date of initial signup.
              You may request cancellation at any time from the billing portal; cancellation
              is scheduled for period end, and access continues until the end of the current billing period.
            </p>
          </section>

          <section>
            <h2
              className="text-xl font-bold mb-3"
              style={{ fontFamily: "var(--font-space-grotesk)" }}
            >
              4. Refund Policy
            </h2>
            <p>
              All scans are processed immediately upon payment. Because scan results are
              generated algorithmically and cannot be &quot;returned,&quot; <strong>we do not
              offer refunds for completed scans</strong>, regardless of whether you agree
              with or act on the findings.
            </p>
            <p>
              If you believe you have been charged in error, contact us at{" "}
              <a href="mailto:billing@complyscan.com" className="text-accent-blue hover:underline">
                billing@complyscan.com
              </a>{" "}
              within 7 days of the charge and we will investigate.
            </p>
            <p>
              Subscription cancellations made before the next billing date will prevent
              the next charge. No pro-rata refunds are provided for partial months.
            </p>
          </section>

          <section>
            <h2
              className="text-xl font-bold mb-3"
              style={{ fontFamily: "var(--font-space-grotesk)" }}
            >
              5. Limitation of Liability
            </h2>
            <p>
              ComplyScan is a compliance <em>screening tool</em>, not a law firm or
              legal service. We make no warranties, express or implied, about the completeness,
              accuracy, or reliability of scan results. Compliance findings should be
              reviewed by a qualified legal professional before taking action.
            </p>
            <p>
              In no event shall ComplyScan, its operators, or affiliates be liable for
              any indirect, incidental, special, consequential, or punitive damages,
              including without limitation loss of profits, data, use, goodwill, or
              other intangible losses, resulting from your use of the service or
              reliance on any compliance report.
            </p>
            <p>
              Our total liability for any claim arising from use of the service shall
              not exceed the amount you paid for the specific scan or subscription
              giving rise to the claim.
            </p>
          </section>

          <section>
            <h2
              className="text-xl font-bold mb-3"
              style={{ fontFamily: "var(--font-space-grotesk)" }}
            >
              6. Acceptable Use
            </h2>
            <p>You agree not to use ComplyScan to:</p>
            <ul>
              <li>Scan websites you do not own or have explicit permission to audit</li>
              <li>Use scan results to extort, embarrass, or cause reputational harm to website owners</li>
              <li>Resell, redistribute, or republish scan reports without ComplyScan's written consent</li>
              <li>Attempt to reverse-engineer, copy, or replicate the ComplyScan service</li>
              <li>Use the service in any manner that violates applicable law</li>
            </ul>
            <p>
              ComplyScan reserves the right to suspend or terminate accounts that violate
              these terms without prior notice or refund.
            </p>
          </section>

          <section>
            <h2
              className="text-xl font-bold mb-3"
              style={{ fontFamily: "var(--font-space-grotesk)" }}
            >
              7. Intellectual Property
            </h2>
            <p>
              ComplyScan's name, logo, report format, methodology, and website design
              are proprietary. You may not use our branding in your own materials
              without written permission.
            </p>
            <p>
              Scan reports are generated from ComplyScan's proprietary analysis framework.
              You may use findings from your own scans internally. Reproduction or
              commercial use of report content requires a license from ComplyScan.
            </p>
          </section>

          <section>
            <h2
              className="text-xl font-bold mb-3"
              style={{ fontFamily: "var(--font-space-grotesk)" }}
            >
              8. Service Availability
            </h2>
            <p>
              ComplyScan strives for high availability but does not guarantee
              uninterrupted service. Scheduled maintenance, infrastructure issues,
              or third-party service outages may cause temporary unavailability.
              We are not liable for downtime or lost business resulting from
              service interruptions.
            </p>
          </section>

          <section>
            <h2
              className="text-xl font-bold mb-3"
              style={{ fontFamily: "var(--font-space-grotesk)" }}
            >
              9. Changes to These Terms
            </h2>
            <p>
              We may update these Terms of Service from time to time. Material changes
              will be communicated via email to active subscribers at least 14 days
              before taking effect. Continued use of ComplyScan after changes take
              effect constitutes acceptance of the revised terms.
            </p>
          </section>

          <section>
            <h2
              className="text-xl font-bold mb-3"
              style={{ fontFamily: "var(--font-space-grotesk)" }}
            >
              10. Contact
            </h2>
            <p>
              Questions about these Terms of Service should be directed to:
            </p>
            <p>
              <a
                href="mailto:compliance@complyscan.com"
                className="text-accent-blue hover:underline"
              >
                compliance@complyscan.com
              </a>
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}


