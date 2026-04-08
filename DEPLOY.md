# ComplyScan — Deployment Guide

## What You Need Before Starting

| Service | Sign up | Free tier |
|---------|---------|-----------|
| Cloudflare Pages | cloudflare.com | ✅ Yes (unlimited static pages) |
| Stripe | dashboard.stripe.com | ✅ Yes (test mode) |
| Mailjet | mailjet.com | ✅ Yes (varies) |
| AI API (OpenAI-compatible) | your provider | ⚠️ Check your plan |
| Cloudflare Browser Rendering | dash.cloudflare.com | ⚠️ Depends on plan |

---

## Step 1 — Stripe Setup (10 minutes)

1. Go to **dashboard.stripe.com** → toggle **Test mode** (top right)

2. **Create Monthly Agency subscription:**
   - Products → Add product
   - Name: `Monthly GDPR Monitor`
   - Price: $99.00 USD / month (recurring)
   - Save → copy the `price_...` ID

3. **Create credit packs (one-time payment):**
   - Product: `ComplyScan Credits`
   - Price A: $29 one-time (3 credits) → copy `price_...` as `STRIPE_PRICE_CREDITS_3`
   - Price B: $79 one-time (10 credits) → copy `price_...` as `STRIPE_PRICE_CREDITS_10`

4. **Get API keys:**
   - Developers → API keys
   - Copy `pk_test_...` (publishable) and `sk_test_...` (secret)

5. **Set up webhook (for local dev only):**
   ```bash
   npm install -g stripe
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```
   Copy the `whsec_...` secret it gives you.

---

## Step 2 — Mailjet Email (2 minutes)

Set these secrets if you want email nurture and report delivery:

- `MAILJET_API_KEY`
- `MAILJET_SECRET_KEY`
- `MAILJET_LIST_ID`

---

## Step 3 — Push to GitHub

```bash
cd /home/thomas/Dropbox/Projects/compliance-checker

# Initialize git (only once)
git init
git add .
git commit -m "ComplyScan — fully built, ready to deploy"

# Create a repo on GitHub (github.com/new)
# Then:
git remote add origin git@github.com:your-username/complyscan.git
git branch -M main
git push -u origin main
```

---

## Step 4 — Deploy to Cloudflare Pages (5 minutes)

1. Go to **dash.cloudflare.com** → Pages → Create a project → Connect to Git

2. Select your GitHub repo

3. **Framework preset:** Next.js (or `open-next` if available)

4. **Build command:** `npm run build`

5. **Build output directory:** `.open-next`

6. **Environment variables** — add these (Settings → Environment Variables):
   ```
   # AI (OpenAI-compatible)
   OPENAI_API_KEY=***
   OPENAI_BASE_URL=***

   # Stripe
   STRIPE_SECRET_KEY=***
   STRIPE_WEBHOOK_SECRET=***
   STRIPE_PRICE_MONTHLY=price_...      # $99/month recurring product
   STRIPE_PRICE_CREDITS_3=price_...    # $29 one-time (3 credits)
   STRIPE_PRICE_CREDITS_10=price_...   # $79 one-time (10 credits)

   # Cloudflare Browser Rendering (serverless PDF)
   CF_BROWSER_RENDERING_ACCOUNT_ID=***
   CF_BROWSER_RENDERING_API_TOKEN=***

   # Email
   MAILJET_API_KEY=***
   MAILJET_SECRET_KEY=***
   MAILJET_LIST_ID=***

   # App
   NEXT_PUBLIC_APP_URL=https://complyscan.pages.dev
   ```

7. **Deploy** → Copy your Cloudflare Pages URL (e.g. `complyscan.pages.dev`)

---

## Step 5 — Stripe Webhook (Production)

On Cloudflare dashboard → your project → Settings → Environment Variables:
```
STRIPE_WEBHOOK_SECRET=***
```

Then on Stripe dashboard:
- Developers → Webhooks → Add endpoint
- URL: `https://your-project.pages.dev/api/stripe/webhook`
- Events: `checkout.session.completed`, `customer.subscription.deleted`
- Copy the webhook signing secret to Cloudflare Pages

---

## Step 6 — Update NEXT_PUBLIC_APP_URL

After deploying, update the env var on Cloudflare Pages:
```
NEXT_PUBLIC_APP_URL = https://complyscan.pages.dev
```
Trigger a new deployment to apply.

---

## Architecture Note

Scans are designed to run via a Cloudflare Queue and a Worker (`workers/scan-processor/`) in production. Ensure your Pages project has the same bindings as `wrangler.toml` (D1 `DB`, Queue `SCAN_QUEUE`, optional `AI` and optional `REPORTS_BUCKET`).

The frontend deploys to **Cloudflare Pages** (via OpenNext). A separate **Cloudflare Worker** (`workers/scan-processor/`) handles background scan processing via `wrangler.toml`.
