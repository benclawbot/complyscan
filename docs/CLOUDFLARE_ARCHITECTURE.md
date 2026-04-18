# ComplyScan Cloudflare Architecture

## Production shape

1. Cloudflare Pages (`complyscan.pages.dev`)
- Next.js frontend + lightweight API routes
- Session-authenticated dashboard/report/payment routes

2. Cloudflare Queue Worker (`compliance-checker-scan-processor`)
- Consumes scan queue
- Runs crawl + analysis pipeline
- Writes results back to D1

## Auth/Payments architecture

- Authentication is cookie-based (`session`, HttpOnly).
- Password + passkey login is supported.
- Recovery is recovery-code based (no email reset).
- Stripe checkout requires authenticated users and carries `metadata[userId]`.
- Subscription entitlement is linked by `subscribers.user_id`.
- No token URL auth (`?token=`) and no subscriber token table usage.

## Required bindings

### Pages
- D1: `DB`
- Queue producer: `SCAN_QUEUE`
- R2 (optional): `REPORTS_BUCKET`
- AI (optional): `AI`

### Worker
- D1: `DB`
- Queue consumer: `SCAN_QUEUE`
- AI: `AI`

## Operational notes

- Pages health: `/`
- API health: `/api/health`
- Worker health: `/health` endpoint on scan worker
- Expected scan lifecycle: `pending` -> `processing` -> `completed`
