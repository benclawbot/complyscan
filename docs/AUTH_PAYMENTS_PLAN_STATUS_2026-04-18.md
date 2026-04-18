# Auth/Payments Refactor Status (2026-04-18)

Source plan:
- Codex session `rollout-2026-04-18T18-12-10-019da15d-295a-7f62-90cb-0dc49dad5572.jsonl`
- Proposed at `2026-04-18 16:40` (Europe/Zurich): "Fresh-Start Auth + Payments Flow (Hybrid Gate, Passkey, No Email)"

Checked against current repository state at `2026-04-18 20:02` (Europe/Zurich).

## Checklist

| Plan Item | Status | Evidence |
|---|---|---|
| Single cookie auth (`session`), remove legacy `session_token` runtime flow | Done | `app/api/auth/login/route.ts`, `app/api/auth/signup/route.ts`, `app/api/auth/claim-scan/route.ts`, `app/api/auth/me/route.ts` |
| Remove `?token=` runtime auth paths | Done | No runtime matches under `app/`/`lib/`; docs now state removal (`README.md`, `DEPLOY.md`, `TESTING_PLAN.md`) |
| Add logout endpoint that revokes session and clears cookie | Done | `app/api/auth/logout/route.ts` |
| Replace subscriber-token auth with session + `user_id` ownership | Done | `lib/auth.ts` (`requireUserSession`, `requireAgencySession`, `getActiveSubscriberForUser`) and agency routes under `app/api/clients`, `app/api/scan/client`, `app/api/scan/subscriber` |
| Auth-gated checkout (must be logged in before Stripe session creation) | Done | `app/api/stripe/checkout/route.ts` uses `requireUserSession`; returns `401` when unauthenticated |
| Include Stripe `metadata[userId]` for ownership linkage | Done | `app/api/stripe/checkout/route.ts`, `app/api/stripe/checkout-credits/route.ts` |
| Reconcile webhook/session data by `user_id` | Done | `app/api/stripe/webhook/route.ts`, `app/api/stripe/session/route.ts` |
| Success flow reaches dashboard without token query auth | Done | `app/success/SuccessClient.tsx` routes to `/dashboard` |
| Add passkey API endpoints | Done | `app/api/auth/passkey/register/options`, `register/verify`, `login/options`, `login/verify`, `credentials` |
| Add recovery code API endpoints | Done | `app/api/auth/recovery-codes/regenerate`, `redeem` |
| Login screen supports password + passkey, no email-link login | Done | `app/login/page.tsx` |
| Add Security screen (manage passkeys + recovery codes) | Done | `app/security/page.tsx`, links from `app/dashboard/DashboardClient.tsx` |
| Add Forgot Password screen using recovery code (no email) | Done | `app/forgot-password/page.tsx` |
| Deprecate legacy `/api/login` email-link endpoint | Done | `app/api/login/route.ts` returns `410` + `EMAIL_LOGIN_REMOVED` |
| Migration introduces passkeys/recovery + drops `subscriber_tokens` | Done | `d1-migrations/0004_auth_session_passkeys.sql` |
| CSRF hardening (`csrf` + `X-CSRF-Token` double-submit) | Done | `lib/csrf.ts`, `lib/client-csrf.ts`, `app/api/auth/csrf/route.ts`, plus CSRF checks in auth/payment/client/scan mutation routes |
| Fresh-start DB wipe/reset execution for real environment | Done | Executed against Cloudflare D1 remote `DB` (`3f5f083a-1943-46cd-b661-5df10f9fecce`): dropped/recreated auth/payment tables, verified table set includes `users,sessions,subscribers,agency_clients,report_purchases,brandings,passkey_credentials,webauthn_challenges,recovery_codes`; verified counts `users=0,sessions=0,subscribers=0,report_purchases=0,passkey_credentials=0`; verified `subscriber_tokens` table absent |

## Current Verification Snapshot

- Tests: `npm test` passed (`6` test files, `44` tests).
- Lint: `npm run lint` passed with warnings only (`0` errors, `3` warnings).
- Remote DB (production binding): reset + schema verification completed on `2026-04-18`.
- Git state: refactor is present but not committed (many modified/new files).
