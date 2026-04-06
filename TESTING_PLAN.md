# ComplyScan Full Workflow Testing Plan

## Environment
- **App URL**: https://complyscan.pages.dev (Cloudflare Pages)
- **Local Dev**: http://localhost:8787 (wrangler pages dev)
- **Test Website**: https://example.com (realistic target for automated testing)
- **Stripe**: Test mode (pk_test_... / sk_test_...)
- **Browserless API Key**: `2U8sCY...7372` (configured in .env.local)

---

## Test Credentials
- **Test card (Stripe)**: 4242 4242 4242 4242 | any future date | any CVV
- **Test email**: thomas@benposta.com (or use fresh test emails per run)

---

## Deployment

**Target**: Cloudflare Pages (NOT Vercel)
- `npx wrangler pages deploy .open-next --project-name=compliance-checker`
- Or via GitHub integration: push to `cloudflare-pages` branch
- Environment variables set via Cloudflare Pages dashboard or `wrangler secret put`

**Critical env vars needed**:
```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PDF_REPORT=price_...
STRIPE_PRICE_MONTHLY=price_...
BROWSERLESS_API_KEY=2U8sCY...7372
MINIMAX_API_KEY=...
DATABASE_PATH=/tmp/complyscan.db
NEXT_PUBLIC_APP_URL=https://complyscan.pages.dev
```

---

## Test Suites

### SUITE 1: Free Scan Flow
**Flow**: Homepage → Enter URL + email → Click "Scan Free" → Wait for results

**Steps**:
1. Navigate to https://complyscan.pages.dev
2. Enter URL: `https://example.com`
3. Enter email: `e2e-free-001@benposta.com`
4. Click "Scan Free" button
5. Wait for redirect/scan to complete
6. Verify results page loads with:
   - GDPR Score (0-100)
   - Risk level (LOW/MEDIUM/HIGH)
   - Automated checks section
   - AI Analysis section
   - Issue breakdown
7. Verify no console errors

**Expected Result**: Scan completes, report displays all sections

---

### SUITE 2: PDF Report Purchase (€9)
**Flow**: Homepage → Enter URL → Click "Get PDF Report" → Stripe checkout → Success → Report

**Steps**:
1. Navigate to https://complyscan.pages.dev
2. Enter URL: `https://example.com`
3. Click "Get PDF Report" (Pro plan, €9)
4. Complete Stripe checkout:
   - Email: `e2e-pro-001@benposta.com`
   - Card: 4242 4242 4242 4242
   - Expiry: any future (e.g., 12/28)
   - CVV: 123
5. Wait for redirect to /success page
6. Verify success page shows "Payment Confirmed" state
7. Wait for redirect to /report/{scanId}
8. Verify report page renders with score, sections
9. Click "Download PDF" — verify PDF downloads

**Expected Result**: PDF purchase completes, PDF downloads successfully

---

### SUITE 3: Monthly Subscription (€99/month)
**Flow**: Pricing → "Start Agency" → Stripe checkout → Success with token → Dashboard

**Steps**:
1. Navigate to https://complyscan.pages.dev/pricing
2. Click "Start Agency" on Agency plan (€99/month)
3. Complete Stripe checkout:
   - Email: `e2e-agency-001@benposta.com`
   - Card: 4242 4242 4242 4242
4. Wait for redirect to /success page
5. Verify page shows:
   - "Subscription Active!" heading
   - Dashboard token displayed (subscriberToken in ?token= query)
6. Click "Go to Dashboard" — verify loads at /dashboard?token=...
7. Verify dashboard shows subscriber info (plan, period end)
8. Run 2-3 scans from dashboard
9. Verify all scans appear in scan history
10. Click "View Report" on a scan → verify report renders
11. Click "Download PDF" → verify PDF downloads (no upsell for subscribers)

**Expected Result**: Subscription created, dashboard accessible, scans work, PDF downloads

---

## Success Criteria Status

| Workflow | Status | Notes |
|----------|--------|-------|
| Free scan of example.com | Pending | |
| Report page renders all sections | Pending | |
| PDF download blocked for free scans | Pending | |
| PDF purchase via Stripe | Pending | |
| PDF download works after payment | Pending | |
| Monthly subscription creates subscriber | Pending | |
| Dashboard accessible after subscription | Pending | |
| Subscriber scans (2-3 URLs) | Pending | |
| Subscriber PDF downloads | Pending | |
| No console errors | Pending | |

---

## Known Issues

### Browserless API Key on Cloudflare Pages
The BROWSERLESS_API_KEY is set in `.env.local` but Cloudflare Pages may not use this file.
**Fix**: Set via `npx wrangler secret put BROWSERLESS_API_KEY` or Cloudflare dashboard.

### Subscriber Token on Success Page
Success page (SuccessClient.tsx) fetches `/api/stripe/session?session_id=...` which looks up
the subscriber token in the DB. This should work correctly.

### Test Environment Variables
Local testing with `wrangler pages dev` requires env vars passed via `--var` or `.env` file.
The `DATABASE_PATH=/tmp/complyscan.db` is needed for the local SQLite dev DB.



