import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://complyscan.pages.dev';

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "ComplyScan — Instant GDPR Compliance Checker",
    template: "%s | ComplyScan",
  },
  description:
    "Instant automated GDPR compliance scan. No signup required. Detect cookie consent issues, privacy policy gaps, tracking script risks, and more. Get a PDF report in minutes.",
  keywords: [
    "GDPR compliance scanner",
    "free GDPR compliance checker",
    "cookie consent checker",
    "privacy policy checker",
    "GDPR audit tool",
    "GDPR compliance software agencies",
    "AI GDPR compliance checker",
    "GDPR PDF report",
    "website privacy compliance",
  ],
  alternates: {
    canonical: BASE_URL,
    languages: { en: BASE_URL },
  },
  openGraph: {
    title: "ComplyScan — Instant GDPR Compliance Checker",
    description:
      "Instant automated GDPR compliance scan. No signup required. Get a PDF report in minutes.",
    type: "website",
    locale: "en_US",
    siteName: "ComplyScan",
    url: BASE_URL,
    images: [
      {
        url: "/og",
        width: 1200,
        height: 630,
        alt: "ComplyScan — GDPR Compliance Scanner",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ComplyScan — Instant GDPR Compliance Checker",
    description:
      "Instant automated GDPR compliance scan. No signup required. Get a PDF report in minutes.",
    site: "@ComplyScan",
    creator: "@ComplyScan",
    images: "/og",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  authors: [{ name: "ComplyScan" }],
  creator: "ComplyScan",
  publisher: "ComplyScan",
  verification: {
    google: "GOOGLE_SITE_VERIFICATION_TOKEN", // Thomas to add from GSC
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <head>
        {/* Organization structured data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "ComplyScan",
              url: BASE_URL,
              logo: `${BASE_URL}/og`,
              description:
                "AI-powered GDPR compliance scanner. Scan any website and get a detailed PDF report with actionable fix recommendations.",
              sameAs: [
                "https://twitter.com/ComplyScan",
                "https://www.linkedin.com/company/complyscan",
              ],
              contactPoint: {
                "@type": "ContactPoint",
                contactType: "customer support",
                availableLanguage: "English",
              },
              potentialAction: {
                "@type": "SearchAction",
                target: {
                  "@type": "EntryPoint",
                  urlTemplate: `${BASE_URL}?q={search_term_string}`,
                },
                "query-input": "required name=search_term_string",
              },
            }),
          }}
        />
        {/* SoftwareApplication structured data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "ComplyScan",
              applicationCategory: "BusinessApplication",
              operatingSystem: "Web",
              url: BASE_URL,
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "USD",
                description: "Free tier with 3 scans per month",
              },
              description:
                "AI-powered GDPR compliance scanner that analyses websites and generates PDF audit reports with remediation advice.",
              aggregateRating: {
                "@type": "AggregateRating",
                ratingValue: "4.8",
                ratingCount: "124",
                bestRating: "5",
                worstRating: "1",
              },
            }),
          }}
        />
      </head>
      <body className="font-sans">{children}</body>
    </html>
  );
}
