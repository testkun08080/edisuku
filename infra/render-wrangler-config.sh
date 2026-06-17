#!/usr/bin/env bash
## Substitute placeholders in wrangler templates (manual setup and deploy.yml).
##
## Usage: render-wrangler-config.sh [--target api|web|all] [--env staging|production|all]
##   --target  Which config to generate: api, web, or all (default: all)
##   --env     Which environment's placeholders are required: staging, production, or all (default: all)
##
## CI example (only staging secrets required):
##   render-wrangler-config.sh --target api --env staging
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
target=all
deploy_env=all

usage() {
  sed -n '3,10p' "$0" | sed 's/^## \{0,1\}//'
}

while [ $# -gt 0 ]; do
  case "$1" in
    --target)
      [ $# -lt 2 ] && { echo "[render-wrangler-config] --target requires a value (api, web, or all)" >&2; exit 1; }
      target="$2"; shift 2 ;;
    --env)
      [ $# -lt 2 ] && { echo "[render-wrangler-config] --env requires a value (staging, production, or all)" >&2; exit 1; }
      deploy_env="$2"; shift 2 ;;
    -h | --help)
      usage; exit 0 ;;
    *)
      echo "[render-wrangler-config] unknown argument: $1" >&2; usage >&2; exit 1 ;;
  esac
done

case "$target" in
  api | web | all) ;;
  *) echo "[render-wrangler-config] invalid --target: $target (expected api, web, or all)" >&2; exit 1 ;;
esac

case "$deploy_env" in
  staging | production | all) ;;
  *) echo "[render-wrangler-config] invalid --env: $deploy_env (expected staging, production, or all)" >&2; exit 1 ;;
esac

require_env() {
  for v in "$@"; do
    if [ -z "${!v:-}" ]; then
      echo "[render-wrangler-config] missing env: $v" >&2
      exit 1
    fi
  done
}

# Build required-env list based on --target and --env
required=()
needs_staging_d1=false; needs_prod_d1=false
needs_staging_kv=false; needs_prod_kv=false
needs_staging_web=false; needs_prod_web=false

if [ "$target" = api ] || [ "$target" = all ]; then
  if [ "$deploy_env" = staging  ] || [ "$deploy_env" = all ]; then
    needs_staging_d1=true; needs_staging_kv=true; needs_staging_web=true
  fi
  if [ "$deploy_env" = production ] || [ "$deploy_env" = all ]; then
    needs_prod_d1=true; needs_prod_kv=true; needs_prod_web=true
  fi
fi
if [ "$target" = web ] || [ "$target" = all ]; then
  if [ "$deploy_env" = staging  ] || [ "$deploy_env" = all ]; then
    needs_staging_web=true
  fi
  if [ "$deploy_env" = production ] || [ "$deploy_env" = all ]; then
    needs_prod_web=true
  fi
fi

$needs_staging_d1  && required+=(STAGING_D1_ID)
$needs_prod_d1     && required+=(PROD_D1_ID)
$needs_staging_kv  && required+=(STAGING_KV_ID)
$needs_prod_kv     && required+=(PROD_KV_ID)
$needs_staging_web && required+=(STAGING_WEB_URL)
$needs_prod_web    && required+=(PROD_WEB_URL)

require_env "${required[@]}"

escape_sed() {
  printf '%s' "$1" | sed -e 's/[&/\]/\\&/g'
}

# Provide safe fallback for values not required in this run
_d() { escape_sed "${!1:-UNUSED}"; }

render_api() {
  sed \
    -e "s|__STAGING_D1_ID__|$(_d STAGING_D1_ID)|g" \
    -e "s|__PROD_D1_ID__|$(_d PROD_D1_ID)|g" \
    -e "s|__STAGING_KV_ID__|$(_d STAGING_KV_ID)|g" \
    -e "s|__PROD_KV_ID__|$(_d PROD_KV_ID)|g" \
    -e "s|__STAGING_WEB_URL__|$(_d STAGING_WEB_URL)|g" \
    -e "s|__PROD_WEB_URL__|$(_d PROD_WEB_URL)|g" \
    "$repo_root/apps/api/wrangler.toml.template" >"$repo_root/apps/api/wrangler.toml"
}

render_web() {
  sed \
    -e "s|__STAGING_WEB_URL__|$(_d STAGING_WEB_URL)|g" \
    -e "s|__PROD_WEB_URL__|$(_d PROD_WEB_URL)|g" \
    "$repo_root/apps/web/wrangler.jsonc.template" >"$repo_root/apps/web/wrangler.jsonc"
}

written=()
case "$target" in
  api) render_api; written+=("apps/api/wrangler.toml") ;;
  web) render_web; written+=("apps/web/wrangler.jsonc") ;;
  all) render_api; render_web; written+=("apps/api/wrangler.toml" "apps/web/wrangler.jsonc") ;;
esac

echo "[render-wrangler-config] wrote ${written[*]}"
