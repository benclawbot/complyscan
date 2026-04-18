# ComplyScan — Agent Context

## Project Context
See PROJECT_INDEX.md for architecture, conventions, structure, and design decisions.

## Quick Reference
- **Auth:** session cookie (`session`) only
- **Login:** password + passkey
- **Recovery:** one-time recovery codes (no email reset)
- **Payments:** Stripe, linked to authenticated `user_id`
- **DB:** Cloudflare D1
- **Deployment:** Cloudflare Pages + Workers
- **AI:** Cloudflare AI with rule-based fallback

## Preferences
- Always identify root cause before fixing
- Simplest solution, surgical diffs
- Keep auth and payment ownership links explicit (`user_id`)
- Do not reintroduce tokenized URL auth or email-link login
