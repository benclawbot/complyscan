# ComplyScan — Deployment Guide

## Required Services

| Service | Purpose |
|---------|---------|
| Cloudflare Pages | Host app |
| Cloudflare D1 | Persistent data |
| Stripe | Subscription + credit checkout |
| Cloudflare Queue Worker | Background scan processing |

## Required Environment Variables

```bash
# Stripe
STRIPE_SECRET_KEY=***
STRIPE_WEBHOOK_SECRET=***
STRIPE_PRICE_MONTHLY=price_...
STRIPE_PRICE_CREDITS_3=price_...
STRIPE_PRICE_CREDITS_10=price_...

# App
NEXT_PUBLIC_APP_URL=https://complyscan.pages.dev

# Optional passkey override (recommended in production custom domain)
WEBAUTHN_RP_ID=your-domain.com
```

## Auth/Payment deployment checks

- `session` cookie is set on login and passkey login.
- `/api/stripe/checkout` and `/api/stripe/checkout-credits` return `401` when unauthenticated.
- Stripe subscription checkout contains `metadata[userId]`.
- Webhook creates/updates `subscribers.user_id` and status fields.
- No route depends on `?token=` or `session_token` cookie.

## Webhook events

Enable:
- `checkout.session.completed`
- `customer.subscription.updated`
- `invoice.payment_succeeded`
- `customer.subscription.deleted`
