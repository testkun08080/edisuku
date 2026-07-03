#!/usr/bin/env bash
## Start API + Web for E2E (Playwright webServer or manual smoke).
set -euo pipefail

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)

cp -f "$REPO_ROOT/apps/api/.dev.vars.example" "$REPO_ROOT/apps/api/.dev.vars"
cp -f "$REPO_ROOT/apps/web/.dev.vars.example" "$REPO_ROOT/apps/web/.dev.vars"

if [ ! -f "$REPO_ROOT/apps/api/wrangler.toml" ]; then
  cp -f "$REPO_ROOT/apps/api/wrangler.toml.template" "$REPO_ROOT/apps/api/wrangler.toml"
fi

if [ ! -f "$REPO_ROOT/apps/web/wrangler.jsonc" ]; then
  cp -f "$REPO_ROOT/apps/web/wrangler.jsonc.template" "$REPO_ROOT/apps/web/wrangler.jsonc"
fi

bash "$REPO_ROOT/infra/init/prepare-local-d1.sh"

API_PID=""
WEB_PID=""

cleanup() {
  if [ -n "$API_PID" ]; then kill "$API_PID" 2>/dev/null || true; fi
  if [ -n "$WEB_PID" ]; then kill "$WEB_PID" 2>/dev/null || true; fi
}
trap cleanup EXIT INT TERM

cd "$REPO_ROOT/apps/api"
pnpm exec wrangler dev --ip 127.0.0.1 --port 8787 &
API_PID=$!

cd "$REPO_ROOT/apps/web"
pnpm dev --host 127.0.0.1 --port 3000 &
WEB_PID=$!

echo "[ci-e2e-stack] waiting for API health..."
for _ in $(seq 1 60); do
  if curl -sf http://127.0.0.1:8787/api/health | grep -q '"ok":true'; then
    echo "[ci-e2e-stack] API ready"
    break
  fi
  sleep 2
done

if ! curl -sf http://127.0.0.1:8787/api/health | grep -q '"ok":true'; then
  echo "[ci-e2e-stack] API failed to become ready" >&2
  exit 1
fi

echo "[ci-e2e-stack] waiting for Web screener..."
for _ in $(seq 1 60); do
  if curl -sf -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/screener | grep -q "200"; then
    echo "[ci-e2e-stack] Web ready"
    break
  fi
  sleep 2
done

if ! curl -sf -o /dev/null http://127.0.0.1:3000/screener; then
  echo "[ci-e2e-stack] Web failed to become ready" >&2
  exit 1
fi

echo "[ci-e2e-stack] stack running (API=$API_PID, Web=$WEB_PID)"
wait "$API_PID" "$WEB_PID"
