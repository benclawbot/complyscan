ComplyScan Deploy Verification Checklist

1) Runtime and environment sanity
- Use Node.js runtime for local dev/test.
- Verify Stripe and app env vars are set.
- If passkeys are enabled in production, set `WEBAUTHN_RP_ID`.

2) DB schema parity
- Ensure subscribers includes `user_id`.
- Ensure tables exist: `passkey_credentials`, `webauthn_challenges`, `recovery_codes`.
- Ensure legacy table `subscriber_tokens` is absent.

3) Pre-deploy checks
- `npm test`
- `BASE_URL=http://127.0.0.1:3104 npm run test:api:smoke`
- `npm run test:e2e`

4) Production-critical flows
- Signup/login sets `session` cookie and reaches dashboard.
- Passkey registration + login works.
- Recovery-code password reset works (no email).
- Checkout endpoints reject unauthenticated requests.
- Subscription and credits are linked to authenticated user.

5) Stripe webhook verification
- Verify events: `checkout.session.completed`, `customer.subscription.updated`, `invoice.payment_succeeded`, `customer.subscription.deleted`.
- Confirm `subscribers.user_id` and status fields are updated.

6) Post-deploy API probes
- `GET /api/health` -> 200
- `GET /api/auth/me` -> 401 unauthenticated / authenticated payload when logged in
- `POST /api/stripe/checkout` unauthenticated -> 401
- `GET /api/stripe/session?session_id=<id>` -> JSON without subscriber token payload

7) Rollback criteria
- Session auth fails for dashboard/report access
- Checkout succeeds but entitlements are not linked to user
- Passkey or recovery-code flows lock users out unexpectedly
