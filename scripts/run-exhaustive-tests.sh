#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PORT:-3104}"
BASE_URL="http://127.0.0.1:${PORT}"
NODE_BIN="${NODE_BIN:-$HOME/.nvm/versions/node/v22.22.2/bin/node}"
if [[ ! -x "$NODE_BIN" ]]; then NODE_BIN="node"; fi

cleanup() {
  if [[ -n "${DEV_PID:-}" ]] && kill -0 "$DEV_PID" 2>/dev/null; then
    kill "$DEV_PID" || true
    wait "$DEV_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

cd "$ROOT_DIR"
unset NODE || true

echo "[1/4] Starting mocked dev server on ${BASE_URL}"
MOCK_STRIPE=1 MOCK_SCAN=1 NEXT_PUBLIC_APP_URL="$BASE_URL" "$NODE_BIN" ./node_modules/next/dist/bin/next dev -p "$PORT" >/tmp/complyscan-exhaustive-dev.log 2>&1 &
DEV_PID=$!

for i in {1..60}; do
  if "$NODE_BIN" -e "fetch('${BASE_URL}').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"; then
    break
  fi
  sleep 1
  if [[ "$i" == "60" ]]; then
    echo "Dev server failed to start. Tail log:"
    tail -n 120 /tmp/complyscan-exhaustive-dev.log || true
    exit 1
  fi
done

echo "[2/4] Unit tests"
"$NODE_BIN" ./node_modules/vitest/vitest.mjs run

echo "[3/4] API exhaustive route smoke"
BASE_URL="$BASE_URL" "$NODE_BIN" ./scripts/exhaustive-route-smoke.mjs

echo "[4/4] Playwright UI (headed/headless=false)"
PW_EXTERNAL_SERVER=1 BASE_URL="$BASE_URL" MOCK_STRIPE=1 MOCK_SCAN=1 npx playwright test --headed

echo "All exhaustive checks passed."


