#!/bin/sh
## Host local dev: ensure .dev.vars point at localhost, seed local D1, then turbo dev.
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)

ensure_dev_vars() {
  app_dir="$1"
  if [ ! -f "$app_dir/.dev.vars" ]; then
    cp "$app_dir/.dev.vars.example" "$app_dir/.dev.vars"
    echo "[dev-local] created $app_dir/.dev.vars from example"
  fi
}

ensure_dev_vars "$REPO_ROOT/apps/api"
ensure_dev_vars "$REPO_ROOT/apps/web"

web_vars="$REPO_ROOT/apps/web/.dev.vars"
if grep -qE '^API_UPSTREAM_URL=http://api:' "$web_vars" 2>/dev/null; then
  echo "[dev-local] apps/web/.dev.vars has Docker hostname — switching to 127.0.0.1"
  tmp=$(mktemp)
  sed 's|^API_UPSTREAM_URL=http://api:8787|API_UPSTREAM_URL=http://127.0.0.1:8787|' "$web_vars" > "$tmp"
  mv "$tmp" "$web_vars"
fi

if [ ! -f "$REPO_ROOT/apps/api/wrangler.toml" ]; then
  cp "$REPO_ROOT/apps/api/wrangler.toml.template" "$REPO_ROOT/apps/api/wrangler.toml"
fi

bash "$REPO_ROOT/infra/init/prepare-local-d1.sh"

cd "$REPO_ROOT"
exec pnpm exec turbo run dev --parallel
