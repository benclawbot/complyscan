import Link from "next/link";

const footerLinks = [
  { label: "Privacy Policy", href: "/legal/privacy" },
  { label: "Cookie Policy", href: "/legal/cookie-policy" },
  { label: "Terms of Service", href: "/legal/terms" },
  { label: "Blog", href: "/blog" },
];

export function Footer() {
  return (
    <footer id="contact" className="border-t border-white/10 bg-midnight">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo + tagline */}
          <div className="text-center md:text-left">
            <Link
              href="/"
              className="font-heading text-xl font-bold text-white hover:text-accent-glow transition-colors"
            >
              ComplyScan
            </Link>
            <p className="text-white/40 text-sm mt-1">
              GDPR compliance made effortless.
            </p>
          </div>

          {/* Links */}
          <nav className="flex flex-wrap items-center justify-center gap-6">
            {footerLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-sm text-white/50 hover:text-white transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Copyright */}
        <div className="mt-8 pt-8 border-t border-white/5 text-center">
          <p className="text-white/30 text-sm">
            &copy; 2026 ComplyScan. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
