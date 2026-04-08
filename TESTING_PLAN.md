# ComplyScan Full Workflow Testing Plan

## Environment
- App URL: https://complyscan.pages.dev (Cloudflare Pages)
- Local Dev: http://localhost:8787 (wrangler pages dev)
- Test Website: https://example.com
- Stripe: Test mode

## Test Credentials
- Test card (Stripe): 4242 4242 4242 4242 | any future date | any CVV
- Test email: use unique test emails per run

## Critical env vars
```
STRIPE_SECRET_KEY=***
STRIPE_WEBHOOK_SECRET=***
STRIPE_PRICE_MONTHLY=price_...
BROWSERLESS_API_KEY=***
MINIMAX_API_KEY=***
DATABASE_PATH=/tmp/complyscan.db
NEXT_PUBLIC_APP_URL=https://complyscan.pages.dev
```

## Test Suites

### SUITE 1: Free scan flow
Flow: Homepage -> Enter URL + email -> Scan Free -> Scan results

Expected:
- Results page loads
- GDPR score/risk visible
- Rule checks and AI analysis visible
- Free preview banner visible
- Upgrade-to-Agency CTA visible

### SUITE 2: Agency subscription checkout
Flow: Pricing -> Start Agency -> Stripe checkout -> Success -> Dashboard

Expected:
- Stripe checkout opens
- Payment succeeds in test mode
- Success page shows "Subscription Active"
- Dashboard link works
- Dashboard loads with subscriber context

### SUITE 3: Full report rendering + browser print
Flow: Results/Report page -> open full report -> Print / Save as PDF

Expected:
- Full report sections render correctly
- Print button opens print dialog/new tab print flow
- Browser Save as PDF works (no dedicated export API required)

## Success criteria checklist
- [ ] Free scan completes on production URL
- [ ] Results page renders all major sections
- [ ] Upgrade CTA appears for free preview
- [ ] Agency checkout succeeds in test mode
- [ ] Dashboard accessible after subscription
- [ ] Full report view loads successfully
- [ ] Browser print/save-as-PDF works
- [ ] No critical console errors
