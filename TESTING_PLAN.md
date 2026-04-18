# ComplyScan Workflow Testing Plan

## Environment
- App URL: https://complyscan.pages.dev
- Local dev: http://localhost:8787
- Stripe: Test mode

## Core suites

### 1) Auth and recovery
Flow: Signup/Login -> Dashboard -> Logout -> Login again

Expected:
- `session` cookie auth works
- Dashboard loads after login
- Logout revokes server session
- Recovery code reset works without email

### 2) Passkey flow
Flow: Dashboard -> Security -> Add passkey -> Login with passkey

Expected:
- Passkey registration succeeds
- Passkey login creates a valid `session`
- Passkey appears in security list and can be removed

### 3) Checkout gating and linkage
Flow: Pricing -> Start Agency / Buy Credits

Expected:
- Unauthenticated users are prompted to authenticate
- Authenticated users get Stripe checkout URL
- Webhook/session reconciliation links purchase to authenticated `user_id`

### 4) Post-payment access
Flow: Stripe success -> `/success` -> `/dashboard`

Expected:
- Subscription status reflected on dashboard
- Credits reflected after credits purchase
- No `?token=` URL auth required

### 5) Report and PDF access
Flow: Dashboard -> report -> PDF

Expected:
- Access controlled by session ownership (user/subscriber)
- No query-token auth fallback
- Credit gating for paid PDF path still enforced
