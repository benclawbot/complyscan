# ComplyScan Cloudflare Architecture

## Final production shape

ComplyScan now runs as a split Cloudflare-native architecture:

1. Cloudflare Pages (`complyscan.pages.dev`)
   - Serves the Next.js frontend
   - Exposes lightweight API routes for auth, dashboard, reporting, and scan creation
   - Does NOT run the heavy crawl/AI pipeline inline

2. Cloudflare Queue Worker (`compliance-checker-scan-processor`)
   - Consumes `compliance-checker-scan-queue`
   - Fetches and analyzes target sites
   - Writes results back to D1
   - Uses Workers AI when available, but fails open to a fallback score/result if AI fails

## Why this split exists

The original OpenNext Pages worker exceeded Cloudflare free-tier worker size/runtime constraints because it bundled heavy server code paths.

The current architecture fixes that by:
- keeping Pages routes thin
- queueing scans instead of processing them inline
- moving scan execution into a dedicated worker
- making the scan worker self-contained instead of importing large app-side modules at runtime

## Important implementation details

### Pages build
`package.json` build script copies:
- `.open-next/worker.js` -> `.open-next/_worker.js`

This is required so Cloudflare Pages recognizes the worker entry properly.

### Runtime bindings
The Pages app resolves Cloudflare bindings from OpenNext’s request context, not just `request.env`.

Shared helper:
- `lib/env.ts`
- `getRuntimeEnv()` reads from OpenNext/Cloudflare context symbol and supports:
  - `DB`
  - `SCAN_QUEUE`
  - `REPORTS_BUCKET`

### Queue-backed scan endpoints
The following endpoints now create/queue scans instead of running the full scan inline:
- `/api/scan`
- `/api/scan/free`
- `/api/scan/subscriber`
- `/api/scan/client`
- `/api/scan/trigger`
- `/api/scan/user`

### Scan worker
Worker file:
- `workers/scan-processor/src/index.ts`

Current behavior:
- fetch-based crawl
- lightweight HTML heuristics
- rule-based GDPR checks
- Workers AI analysis when available
- fallback AI result when AI invocation/parsing fails

## Required Cloudflare bindings

### Pages project
Production bindings:
- D1: `DB`
- Queue producer: `SCAN_QUEUE`
- R2 bucket: `REPORTS_BUCKET`
- AI binding: `AI`

### Worker
Worker bindings:
- D1: `DB`
- Queue consumer: `SCAN_QUEUE`
- AI binding: `AI`
- optional Mailjet secrets for subscriber emails

## Operational notes

- Pages site is healthy when `/` returns 200
- Worker health endpoint:
  - `https://compliance-checker-scan-processor.benclawbot.workers.dev/health`
- Real production scans should move:
  - `queued/pending` -> `processing` -> `completed`

## Tradeoff

The worker now uses a simplified fetch-based crawler instead of the original browser-heavy crawler. This was the necessary tradeoff to stay within Cloudflare constraints while keeping production scans working end-to-end.
