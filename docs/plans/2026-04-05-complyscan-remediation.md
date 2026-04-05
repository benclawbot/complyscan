# ComplyScan remediation plan

Goal: make ComplyScan work locally and on Cloudflare for free scans, paid PDF reports, and agency/monthly subscriptions, with a reliable automated E2E path.

Architecture:
- Make lib/env.ts support both Cloudflare D1 and local SQLite through one adapter.
- Normalize paid flows so one-time PDF and agency subscription both work in real mode and in deterministic mock-payment E2E mode.
- Fix routes/pages that assumed sync DB access or server-side env where none exists.
- Replace stale deployment-targeted tests with local Playwright flows plus stable route-level tests.

Main tasks:
1. Add a cross-runtime DB adapter and local schema bootstrap.
2. Fix free scan UX/API contract and broken scan-results page.
3. Fix Stripe checkout/session/webhook flow for PDF + agency subscription.
4. Fix dashboard/subscriber/client routes to await DB access and honor agency plan.
5. Lock down PDF download so unpaid users cannot bypass the paywall.
6. Add ESLint config and make lint non-interactive.
7. Switch Playwright to local webServer and add a mock-payments E2E flow.
8. Run build/tests/lint/E2E, then commit/push/deploy.
