#!/bin/sh
## Maintainer: regenerate committed sample SQL (seed + company_metrics + shareholders).
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)
cd "$REPO_ROOT"

echo "[regenerate-sample] generating seed-local-d1.sql"
node infra/init/generate-sample-seed.mjs

CORPUS=/tmp/edisuku-sample-corpus.db
rm -f "$CORPUS"
sqlite3 "$CORPUS" < packages/db/migrations/0000_init.sql
sqlite3 "$CORPUS" < packages/db/migrations/0001_company_metrics.sql
sqlite3 "$CORPUS" < infra/init/seed-local-d1.sql

echo "[regenerate-sample] building company_metrics.sql"
pnpm --filter @edinet/metrics exec tsx ../../infra/init/build-company-metrics.mjs \
  "$CORPUS" ../../infra/init/company_metrics.sql

echo "[regenerate-sample] building shareholder_snapshots.sql"
pnpm --filter @edinet/metrics exec tsx ../../infra/init/build-shareholder-snapshots.mjs \
  ../../infra/init/sample/shareholders ../../infra/init/shareholder_snapshots.sql

echo "[regenerate-sample] done — commit infra/init/*.sql and infra/init/sample/shareholders/ if changed"
