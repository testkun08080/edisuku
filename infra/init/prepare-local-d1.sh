#!/bin/sh
## Load prebuilt sample data into wrangler local D1 (edisuku-local).
## SQL files in infra/init/ are committed — users do not rebuild metrics on each boot.
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)

cd "$REPO_ROOT/apps/api"
cp -f wrangler.toml.template wrangler.toml

d1_query() {
  pnpm exec wrangler d1 execute edisuku-local --local --command "$1" --json 2>/dev/null || echo "[]"
}

table_exists() {
  d1_query "SELECT 1 AS ok FROM sqlite_master WHERE type='table' AND name='$1' LIMIT 1" \
    | grep -q '"ok"'
}

metrics_count() {
  d1_query "SELECT COUNT(*) AS n FROM company_metrics" \
    | grep -oE '"n"[[:space:]]*:[[:space:]]*[0-9]+' \
    | head -1 \
    | grep -oE '[0-9]+$'
}

if ! table_exists companies; then
  echo "[prepare-local-d1] applying schema packages/db/migrations/0000_init.sql"
  pnpm exec wrangler d1 execute edisuku-local --local --file "$REPO_ROOT/packages/db/migrations/0000_init.sql"
else
  echo "[prepare-local-d1] schema already present, skipping 0000_init"
fi

if ! table_exists company_metrics; then
  echo "[prepare-local-d1] applying migration packages/db/migrations/0001_company_metrics.sql"
  pnpm exec wrangler d1 execute edisuku-local --local --file "$REPO_ROOT/packages/db/migrations/0001_company_metrics.sql"
else
  echo "[prepare-local-d1] company_metrics table already present, skipping 0001"
fi

echo "[prepare-local-d1] applying migration packages/db/migrations/0002_drop_legacy_tables.sql"
pnpm exec wrangler d1 execute edisuku-local --local --file "$REPO_ROOT/packages/db/migrations/0002_drop_legacy_tables.sql"

count=$(metrics_count 2>/dev/null || echo "0")
if [ "${count:-0}" -ge 11 ] 2>/dev/null; then
  echo "[prepare-local-d1] sample data already loaded (${count} company_metrics rows), skipping"
  echo "[prepare-local-d1] done"
  exit 0
fi

echo "[prepare-local-d1] loading prebuilt sample (seed + company_metrics + shareholders)"
pnpm exec wrangler d1 execute edisuku-local --local --file "$REPO_ROOT/infra/init/seed-local-d1.sql"

if [ -f "$REPO_ROOT/infra/init/company_metrics.sql" ]; then
  pnpm exec wrangler d1 execute edisuku-local --local --file "$REPO_ROOT/infra/init/company_metrics.sql"
else
  echo "[prepare-local-d1] WARN: infra/init/company_metrics.sql missing — run: pnpm sample:regenerate" >&2
fi

if [ -f "$REPO_ROOT/infra/init/shareholder_snapshots.sql" ]; then
  pnpm exec wrangler d1 execute edisuku-local --local --file "$REPO_ROOT/infra/init/shareholder_snapshots.sql"
fi

echo "[prepare-local-d1] done"
