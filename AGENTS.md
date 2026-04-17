# ComplyScan — Agent Context

## Project Context
See PROJECT_INDEX.md for architecture, conventions, structure, and key design decisions — read it before modifying code.

## Quick Reference
- **Email:** Mailjet (NOT Resend)
- **DB:** Cloudflare D1 — check remote schema if migrations seem out of sync
- **Payments:** Stripe
- **Deployment:** Cloudflare Pages + Workers
- **AI:** Cloudflare AI with rule-based fallback when AI fails

## Known Historical Issues (resolved — for context)
- D1 migration 0003 was missing; direct ALTER/CREATE applied to remote D1
- Agency checkout stall from double-encoded {CHECKOUT_SESSION_ID} in success_url — fixed
- Scoring bug from wrong AI response path (choices[0].messages[0].content) — fixed
- Report-depth: AI payload truncation and duplicate filtering — fixed

## Preferences
- Always identify root cause before fixing
- Simplest solution, surgical diffs
- Proceed to deployment after code fixes unless user asks to review
- Cron jobs: silent on healthy, combine when safely possible
