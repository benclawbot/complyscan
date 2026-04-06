# ComplyScan — Deployment Guide

## What You Need Before Starting

| Service | Sign up | Free tier |
|---------|---------|-----------|
| Cloudflare Pages | cloudflare.com | ✅ Yes (unlimited static pages) |
| Stripe | dashboard.stripe.com | ✅ Yes (test mode) |
| Resend | resend.com | ✅ 100 emails |
| MiniMax API | api.minimax.io | ⚠️ Check your plan |

---

## Step 1 — Stripe Setup (10 minutes)

1. Go to **dashboard.stripe.com** → toggle **Test mode** (top right)

2. **Create Single Scan product:**
   - Products → Add product
   - Name: `GDPR Compliance Scan`
   - Price: $29.00 USD one-time
   - Save → copy the `price_...` ID

3. **Create Monthly Monitor product:**
   - Products → Add product
   - Name: `Monthly GDPR Monitor`
   - Price: $99.00 USD / month (recurring)
   - Save → copy the `price_...` ID

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

## Step 2 — Resend Email (2 minutes)

1. Sign up at **resend.com**
2. Domains → Add your domain (or use the free test domain Resend gives you)
3. Copy your API key (`re_...`)

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
   # AI: MiniMax (OpenAI-compatible endpoint)
   OPENAI_API_KEY=***
   OPENAI_BASE_URL=https://api.minimax.io/v1

   # Stripe
   STRIPE_SECRET_KEY=***
   STRIPE_WEBHOOK_SECRET=***    # from: stripe listen --forward-to localhost:3000/api/stripe/webhook
   STRIPE_PRICE_SINGLE_SCAN=price_...  # $29 one-time product
   STRIPE_PRICE_MONTHLY=price_...      # $99/month recurring product

   # Email
   RESEND_API_KEY=***

   # App
   NEXT_PUBLIC_APP_URL=https://complyscan.pages.dev
   DATABASE_PATH=/tmp/complyscan.db

   # Crawling
   BROWSERLESS_API_KEY=your_browserless_key  # get free 10K credits at browserless.io
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

The crawler runs synchronously in the Stripe webhook handler. For high traffic, move scan processing to a background job queue (e.g. Inngest, Trigger.dev, or a simple cron). Currently: payment → webhook → scan → email, all in one chain.

The frontend deploys to **Cloudflare Pages** (via OpenNext). A separate **Cloudflare Worker** (`workers/scan-processor/`) handles background scan processing via `wrangler.toml`.
