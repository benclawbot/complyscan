# ComplyScan — Project Index

## What this is
GDPR compliance checker SaaS: user enters a URL, gets a full compliance report with findings and fix suggestions. Multi-tier: free scans, credit packs, agency subscription.

## Architecture
- **Next.js 15 (App Router)** — main app
- **Cloudflare Workers** — scan worker (separate from Next.js)
- **Cloudflare D1** — database (agency accounts, users, scans, credits, report_purchases, brandings)
- **Cloudflare Pages** — deployment
- **Stripe** — payments (credit packs + agency subscriptions)
- **Mailjet** — transactional email (NOT Resend)
- **Cloudflare AI** — scoring/analysis in scan worker

## Key Design Decisions
- Scan worker is separate Workers function, not Next.js API route
- D1 database holds all persistent state; migrations in `d1-migrations/`
- Credit-pack purchases use session_id in success URL for webhook self-healing
- Agency checkout had double-encoding bug with {CHECKOUT_SESSION_ID} in success_url — fixed by passing raw placeholder
- Scoring uses Cloudflare AI with heuristic rule-based fallback when AI is unavailable/invalid
- Report-depth fix: AI prompt payload is truncated/cleaned, AI issues filtered for duplicates with rule checks

## Structure
```
src/app/           — Next.js App Router pages and API routes
workers/           — Cloudflare Workers scan worker
lib/               — Shared utilities
d1-migrations/     — Database migrations
ops/               — Deployment/ops scripts
data/              — Static data
```

## Key Database Tables (D1)
- users, scans, credits, report_purchases, brandings
- Migrations may lag schema — if in doubt, check D1 remote schema

## Key Files
- `workers/scan/index.ts` — scan worker (AI parsing, scoring, report generation)
- Stripe webhook handler idempotently applies credits with scan_id marker
- `/api/stripe/session` — returns currentCredits on success

## Anti-patterns to avoid
- Do NOT use Resend for email — use Mailjet
- Do NOT merge Cloudflare tokens with other providers in .env
- Do NOT skip D1 migration sync when adding new tables
- Do NOT assume AI output is always valid — always handle parse failures with fallback
