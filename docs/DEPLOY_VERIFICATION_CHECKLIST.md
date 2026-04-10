ComplyScan Deploy Verification Checklist

1) Runtime and environment sanity
- Use Node.js runtime (not Bun) for local dev/test.
- Verify `node -v` and `npm -v` in shell before tests.
- Confirm required env vars in target environment:
  - STRIPE_SECRET_KEY
  - STRIPE_WEBHOOK_SECRET
  - STRIPE_PRICE_MONTHLY
  - OPENAI_API_KEY (or equivalent AI key path)
  - OPENAI_BASE_URL (if custom)

2) DB schema parity (local + production D1)
- Ensure migrations include users.credits, report_purchases.user_id, and brandings table.
- Validate subscribers has current_period_end and cancel_at_period_end.
- Validate subscriber_tokens has expires_at and last_used_at.

3) Pre-deploy automated checks (mandatory)
- npm test
- BASE_URL=http://127.0.0.1:3104 npm run test:api:smoke  (with mocked server)
- npm run test:e2e:headed (mocked Stripe + mocked scans)
- or one-shot: npm run test:exhaustive:local

4) Production-critical flows (manual spot checks)
- Free scan from homepage reaches /scan-results/{id}.
- Score is not fixed at 50 across different sites.
- Monthly agency checkout redirects to /success then dashboard.
- /success page does not stall on “Preparing your dashboard access…”
- Dashboard for subscriber shows agency access (not only prior credit packs).
- Cancellation webhook updates dashboard status and blocks new full scans after expiry.
- Dashboard reflects new scans without hard refresh (polling/auto-refresh).

5) Stripe webhook verification
- Verify webhook endpoint receives:
  - checkout.session.completed
  - customer.subscription.updated
  - invoice.payment_succeeded
  - customer.subscription.deleted
- Confirm subscriber status/current_period_end/cancel_at_period_end are updated accordingly.

6) Post-deploy API probes
- GET /api/health -> 200 JSON
- POST /api/scan/free (valid payload) -> 200 with scanId
- POST /api/stripe/checkout (monthly) -> 200 with URL (or explicit config error during staging)
- GET /api/stripe/session?session_id=<id> -> JSON response (not empty 500)

7) Rollback criteria
Rollback immediately if any of these are observed:
- Free scan returns 500 on valid input
- Success page stuck preparing token for >30s
- Subscriber cannot access unlimited scans after successful payment
- customer.subscription.deleted not reflected in dashboard/auth checks
