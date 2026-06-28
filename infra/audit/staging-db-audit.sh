#!/usr/bin/env bash
## Query staging D1 for dead-code / pipeline-gap audit (read-only).
##
## Usage: bash infra/audit/staging-db-audit.sh [--markdown]
##   --markdown  Print Markdown (default: human-readable summary)
##
## Credentials: CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID, or `wrangler login` OAuth.
## Config: apps/api/wrangler.toml (rendered via infra/render-wrangler-config.sh when missing).
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/../.." && pwd)"
api_dir="$repo_root/apps/api"
wrangler_toml="$api_dir/wrangler.toml"
D1_NAME="${D1_STAGING_NAME:-edisuku-db-staging}"
OUTPUT_MD=false

while [ $# -gt 0 ]; do
  case "$1" in
    --markdown) OUTPUT_MD=true; shift ;;
    -h | --help)
      sed -n '2,8p' "$0" | sed 's/^## \{0,1\}//'
      exit 0
      ;;
    *) echo "[staging-db-audit] unknown argument: $1" >&2; exit 1 ;;
  esac
done

print_skipped() {
  local reason="$1"
  if $OUTPUT_MD; then
    cat <<EOF
## Staging D1 audit

**Status:** skipped

**Reason:** $reason

Set \`CLOUDFLARE_API_TOKEN\` and \`CLOUDFLARE_ACCOUNT_ID\`, or run \`wrangler login\`, and ensure \`apps/api/wrangler.toml\` exists (or \`STAGING_D1_ID\` for render).
EOF
  else
    echo "[staging-db-audit] SKIPPED: $reason"
  fi
  exit 0
}

has_wrangler_auth() {
  if [ -n "${CLOUDFLARE_API_TOKEN:-}" ] && [ -n "${CLOUDFLARE_ACCOUNT_ID:-}" ]; then
    return 0
  fi
  (cd "$api_dir" && pnpm exec wrangler whoami >/dev/null 2>&1)
}

ensure_wrangler_config() {
  if [ -f "$wrangler_toml" ]; then
    return 0
  fi
  if [ -z "${STAGING_D1_ID:-}" ]; then
    print_skipped "apps/api/wrangler.toml missing and STAGING_D1_ID unset"
  fi
  export STAGING_KV_ID="${STAGING_KV_ID:-00000000-0000-0000-0000-000000000000}"
  export STAGING_WEB_URL="${STAGING_WEB_URL:-https://example.com}"
  bash "$repo_root/infra/render-wrangler-config.sh" --target api --env staging
}

extract_scalar() {
  local json="$1"
  local key="$2"
  if command -v jq >/dev/null 2>&1; then
    echo "$json" | jq -r ".[0].results[0].${key} // empty" 2>/dev/null || true
  else
    node -e "
      const j = JSON.parse(process.argv[1]);
      const row = j?.[0]?.results?.[0] ?? {};
      const v = row[process.argv[2]];
      if (v !== undefined && v !== null) process.stdout.write(String(v));
    " "$json" "$key"
  fi
}

run_query() {
  local sql="$1"
  (cd "$api_dir" && pnpm exec wrangler d1 execute "$D1_NAME" --remote --env staging --json --command "$sql")
}

if ! has_wrangler_auth; then
  print_skipped "Cloudflare credentials missing (set CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID or run wrangler login)"
fi

ensure_wrangler_config

TABLES="companies documents period_financials company_metrics shareholder_snapshots sec_code_latest_periods daily_metrics raw_files_index pipeline_runs"

count_rows() {
  local table="$1"
  extract_scalar "$(run_query "SELECT COUNT(*) AS c FROM ${table}")" c
}

RESULT_raw_files_index="$(run_query "SELECT COUNT(*) AS c FROM raw_files_index")"
RESULT_pipeline_runs="$(run_query "SELECT COUNT(*) AS c FROM pipeline_runs")"
RESULT_sec_latest_max="$(run_query "SELECT MAX(updated_at) AS v FROM sec_code_latest_periods")"
RESULT_company_metrics_max="$(run_query "SELECT MAX(updated_at) AS v FROM company_metrics")"
RESULT_period_financials_max="$(run_query "SELECT MAX(updated_at) AS v FROM period_financials")"
RESULT_shareholders="$(run_query "SELECT COUNT(DISTINCT sec_code) AS distinct_sec_codes, MAX(updated_at) AS max_updated_at FROM shareholder_snapshots")"
RESULT_companies_industry="$(run_query "SELECT COUNT(*) AS c FROM companies WHERE industry IS NOT NULL AND industry != ''")"
RESULT_metrics_industry_join="$(run_query "SELECT COUNT(*) AS c FROM company_metrics cm JOIN companies c ON cm.edinet_code = c.edinet_code WHERE c.industry IS NOT NULL AND c.industry != ''")"
RESULT_pf_without_cm="$(run_query "SELECT COUNT(*) AS c FROM period_financials pf LEFT JOIN company_metrics cm ON pf.sec_code = cm.sec_code WHERE cm.sec_code IS NULL AND pf.sec_code IS NOT NULL AND pf.sec_code != ''")"
RESULT_ci_raw_paths="$(run_query "SELECT COUNT(*) AS c FROM period_financials WHERE raw_tsv_path LIKE 'data/raw/%'")"
RESULT_ordinance_docs="$(run_query "SELECT COUNT(*) AS c FROM documents WHERE ordinance_code IS NOT NULL")"

if $OUTPUT_MD; then
  cat <<EOF
## Staging D1 audit

**Status:** completed ($(date -u +"%Y-%m-%dT%H:%M:%SZ") UTC)
**Database:** \`$D1_NAME\` (remote)

### Table row counts

| Table | Rows |
| --- | ---: |
EOF
  for t in $TABLES; do
    echo "| ${t} | $(count_rows "$t") |"
  done
  cat <<EOF

### Pipeline / freshness checks

| Check | Value |
| --- | --- |
| raw_files_index rows | $(extract_scalar "$RESULT_raw_files_index" c) |
| pipeline_runs rows | $(extract_scalar "$RESULT_pipeline_runs" c) |
| sec_code_latest_periods max(updated_at) | $(extract_scalar "$RESULT_sec_latest_max" v) |
| company_metrics max(updated_at) | $(extract_scalar "$RESULT_company_metrics_max" v) |
| period_financials max(updated_at) | $(extract_scalar "$RESULT_period_financials_max" v) |
| shareholder_snapshots distinct sec_code | $(extract_scalar "$RESULT_shareholders" distinct_sec_codes) |
| shareholder_snapshots max(updated_at) | $(extract_scalar "$RESULT_shareholders" max_updated_at) |
| companies with industry IS NOT NULL | $(extract_scalar "$RESULT_companies_industry" c) |
| company_metrics joined to industry | $(extract_scalar "$RESULT_metrics_industry_join" c) |
| period_financials without company_metrics | $(extract_scalar "$RESULT_pf_without_cm" c) |
| period_financials raw_tsv_path like data/raw/% | $(extract_scalar "$RESULT_ci_raw_paths" c) |
| documents with ordinance_code | $(extract_scalar "$RESULT_ordinance_docs" c) |
EOF
else
  echo "[staging-db-audit] completed ($(date -u +"%Y-%m-%dT%H:%M:%SZ") UTC)"
  echo "Table counts:"
  for t in $TABLES; do
    printf "  %-24s %s\n" "$t" "$(count_rows "$t")"
  done
  echo "Checks:"
  echo "  raw_files_index: $(extract_scalar "$RESULT_raw_files_index" c)"
  echo "  pipeline_runs: $(extract_scalar "$RESULT_pipeline_runs" c)"
  echo "  sec_code_latest_periods max(updated_at): $(extract_scalar "$RESULT_sec_latest_max" v)"
  echo "  company_metrics max(updated_at): $(extract_scalar "$RESULT_company_metrics_max" v)"
  echo "  period_financials max(updated_at): $(extract_scalar "$RESULT_period_financials_max" v)"
  echo "  shareholder_snapshots distinct sec_code: $(extract_scalar "$RESULT_shareholders" distinct_sec_codes)"
  echo "  shareholder_snapshots max(updated_at): $(extract_scalar "$RESULT_shareholders" max_updated_at)"
  echo "  companies industry NOT NULL: $(extract_scalar "$RESULT_companies_industry" c)"
  echo "  company_metrics with industry join: $(extract_scalar "$RESULT_metrics_industry_join" c)"
  echo "  period_financials without company_metrics: $(extract_scalar "$RESULT_pf_without_cm" c)"
  echo "  CI raw_tsv_path (data/raw/%): $(extract_scalar "$RESULT_ci_raw_paths" c)"
  echo "  documents ordinance_code NOT NULL: $(extract_scalar "$RESULT_ordinance_docs" c)"
fi
