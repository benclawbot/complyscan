"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type ConsentChoice = "accepted" | "rejected";

const STORAGE_KEY = "complyscan_cookie_consent";
const COOKIE_NAME = "cookie_consent";

function persist(choice: ConsentChoice) {
  try {
    localStorage.setItem(STORAGE_KEY, choice);
  } catch {}

  const maxAge = 60 * 60 * 24 * 365; // 12 months
  document.cookie = `${COOKIE_NAME}=${choice}; Path=/; Max-Age=${maxAge}; SameSite=Lax; Secure`;
}

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const existing = localStorage.getItem(STORAGE_KEY);
      if (!existing) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  return (
    <div
      id="cookie-consent-banner"
      className="fixed inset-x-0 bottom-0 z-[100] border-t border-white/20 bg-midnight/95 backdrop-blur p-4"
      role="dialog"
      aria-live="polite"
      aria-label="Cookie consent"
    >
      <div className="mx-auto max-w-6xl flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p className="text-sm text-white/80 leading-relaxed">
          We use strictly necessary cookies for login/session functionality. Optional analytics cookies are disabled by default and only enabled after consent.
          Read our <Link href="/legal/cookie-policy" className="underline text-accent-blue">Cookie Policy</Link>.
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              persist("rejected");
              setVisible(false);
            }}
            className="rounded-md border border-white/25 px-3 py-2 text-sm text-white/80 hover:text-white"
          >
            Reject optional cookies
          </button>
          <button
            type="button"
            onClick={() => {
              persist("accepted");
              setVisible(false);
            }}
            className="rounded-md bg-accent-blue px-3 py-2 text-sm font-semibold text-white hover:bg-accent-glow"
          >
            Accept cookies
          </button>
        </div>
      </div>
    </div>
  );
}
