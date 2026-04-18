# ComplyScan — Project Index

## What this is
GDPR compliance checker SaaS: user enters a URL, gets a compliance report with findings and fix suggestions. Tiers: free scans, credit packs, agency subscription.

## Architecture
- **Next.js 15 (App Router)** — frontend + app APIs
- **Cloudflare Workers** — scan worker
- **Cloudflare D1** — users, sessions, subscribers, scans, credits, report_purchases, branding, passkeys, recovery codes
- **Cloudflare Pages** — deployment
- **Stripe** — subscriptions + credits
- **Cloudflare AI** — scoring/analysis in scan worker

## Auth/Payments model
- Cookie-based auth (`session` HttpOnly) for all protected routes.
- Password + passkey sign-in.
- Recovery-code password reset (no email flow).
- Stripe sessions are created only for authenticated users.
- Subscription entitlement is linked by `subscribers.user_id`.
- Stripe webhook/session reconciliation is idempotent for both subscription and credits.

## Key Design Decisions
- No tokenized dashboard/report URLs.
- No email-link login and no nurture-email auth dependencies.
- Checkout success always returns to authenticated dashboard.

## Key files
- `lib/auth.ts` — session + entitlement helpers
- `app/api/auth/*` — password/passkey/recovery/logout endpoints
- `app/api/stripe/*` — checkout/session/webhook linkage
- `app/security/page.tsx` — passkey + recovery code management UI
