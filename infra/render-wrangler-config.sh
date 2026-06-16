#!/usr/bin/env bash
## Substitute placeholders in wrangler templates (manual setup and deploy.yml).
##
## Usage: render-wrangler-config.sh [--target api|web|all]
##   api  — apps/api/wrangler.toml (D1/KV IDs + WEB URLs for CORS)
##   web  — apps/web/wrangler.jsonc (API + WEB URLs)
##   all  — both (default; local fork setup in docs/FORK.md)
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
target=all

usage() {
  sed -n '3,8p' "$0" | sed 's/^## \{0,1\}//'
}

while [ $# -gt 0 ]; do
  case "$1" in
    --target)
      if [ $# -lt 2 ]; then
        echo "[render-wrangler-config] --target requires a value (api, web, or all)" >&2
        exit 1
      fi
      target="$2"
      shift 2
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      echo "[render-wrangler-config] unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

case "$target" in
  api | web | all) ;;
  *)
    echo "[render-wrangler-config] invalid --target: $target (expected api, web, or all)" >&2
    exit 1
    ;;
esac

require_env() {
  for v in "$@"; do
    if [ -z "${!v:-}" ]; then
      echo "[render-wrangler-config] missing env: $v" >&2
      exit 1
    fi
  done
}

api_required=(
  STAGING_D1_ID PROD_D1_ID STAGING_KV_ID PROD_KV_ID
  STAGING_WEB_URL PROD_WEB_URL
)
web_required=(
  STAGING_API_URL PROD_API_URL STAGING_WEB_URL PROD_WEB_URL
)

case "$target" in
  api) require_env "${api_required[@]}" ;;
  web) require_env "${web_required[@]}" ;;
  all) require_env "${api_required[@]}" "${web_required[@]}" ;;
esac

escape_sed() {
  printf '%s' "$1" | sed -e 's/[&/\]/\\&/g'
}

render_api() {
  local s_staging_d1_id s_prod_d1_id s_staging_kv_id s_prod_kv_id
  local s_staging_web_url s_prod_web_url

  s_staging_d1_id=$(escape_sed "$STAGING_D1_ID")
  s_prod_d1_id=$(escape_sed "$PROD_D1_ID")
  s_staging_kv_id=$(escape_sed "$STAGING_KV_ID")
  s_prod_kv_id=$(escape_sed "$PROD_KV_ID")
  s_staging_web_url=$(escape_sed "$STAGING_WEB_URL")
  s_prod_web_url=$(escape_sed "$PROD_WEB_URL")

  sed \
    -e "s|__STAGING_D1_ID__|$s_staging_d1_id|g" \
    -e "s|__PROD_D1_ID__|$s_prod_d1_id|g" \
    -e "s|__STAGING_KV_ID__|$s_staging_kv_id|g" \
    -e "s|__PROD_KV_ID__|$s_prod_kv_id|g" \
    -e "s|__STAGING_WEB_URL__|$s_staging_web_url|g" \
    -e "s|__PROD_WEB_URL__|$s_prod_web_url|g" \
    "$repo_root/apps/api/wrangler.toml.template" >"$repo_root/apps/api/wrangler.toml"
}

render_web() {
  local s_staging_api_url s_prod_api_url s_staging_web_url s_prod_web_url

  s_staging_api_url=$(escape_sed "$STAGING_API_URL")
  s_prod_api_url=$(escape_sed "$PROD_API_URL")
  s_staging_web_url=$(escape_sed "$STAGING_WEB_URL")
  s_prod_web_url=$(escape_sed "$PROD_WEB_URL")

  sed \
    -e "s|__STAGING_API_URL__|$s_staging_api_url|g" \
    -e "s|__PROD_API_URL__|$s_prod_api_url|g" \
    -e "s|__STAGING_WEB_URL__|$s_staging_web_url|g" \
    -e "s|__PROD_WEB_URL__|$s_prod_web_url|g" \
    "$repo_root/apps/web/wrangler.jsonc.template" >"$repo_root/apps/web/wrangler.jsonc"
}

written=()
case "$target" in
  api)
    render_api
    written+=("apps/api/wrangler.toml")
    ;;
  web)
    render_web
    written+=("apps/web/wrangler.jsonc")
    ;;
  all)
    render_api
    render_web
    written+=("apps/api/wrangler.toml" "apps/web/wrangler.jsonc")
    ;;
esac

echo "[render-wrangler-config] wrote ${written[*]}"
