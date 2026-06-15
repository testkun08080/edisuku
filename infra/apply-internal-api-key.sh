#!/usr/bin/env bash
## Upload INTERNAL_API_KEY from .internal-api-key to Cloudflare (api + web, staging + production).
## Does NOT generate a key — you must create .internal-api-key yourself (see .internal-api-key.example).
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
key_file="$repo_root/.internal-api-key"

if [ ! -f "$key_file" ]; then
  echo "Missing $key_file" >&2
  echo "  cp .internal-api-key.example .internal-api-key" >&2
  echo "  # edit .internal-api-key and set your own secret" >&2
  exit 1
fi

INTERNAL_API_KEY=$(grep -v '^#' "$key_file" | grep -v '^[[:space:]]*$' | head -1 | tr -d '\n\r')
if [ -z "$INTERNAL_API_KEY" ] || [ "$INTERNAL_API_KEY" = "your-internal-api-key-change-me" ]; then
  echo "Replace the placeholder in .internal-api-key before running this script." >&2
  exit 1
fi

put_secret() {
  local app_dir="$1"
  local env_name="$2"
  local secret_name="$3"
  local secret_value="$4"
  printf '%s' "$secret_value" | (cd "$app_dir" && npx wrangler secret put "$secret_name" --env "$env_name")
}

WORKERS_SUBDOMAIN="${WORKERS_SUBDOMAIN:-}"
if [ -z "$WORKERS_SUBDOMAIN" ]; then
  yellow() { printf "\033[33m%s\033[0m\n" "$1"; }
  yellow "WORKERS_SUBDOMAIN is not set — skipping API_UPSTREAM_URL on web (set manually if needed)."
  STAGING_API_URL=""
  PROD_API_URL=""
else
  STAGING_API_URL="https://edisuku-api-staging.${WORKERS_SUBDOMAIN}.workers.dev"
  PROD_API_URL="https://edisuku-api.${WORKERS_SUBDOMAIN}.workers.dev"
fi

echo "Uploading INTERNAL_API_KEY to api + web (staging + production)..."
for env_name in staging production; do
  put_secret "$repo_root/apps/api" "$env_name" INTERNAL_API_KEY "$INTERNAL_API_KEY"
  put_secret "$repo_root/apps/web" "$env_name" INTERNAL_API_KEY "$INTERNAL_API_KEY"
done

if [ -n "$STAGING_API_URL" ]; then
  echo "Uploading API_UPSTREAM_URL to web (staging + production)..."
  put_secret "$repo_root/apps/web" staging API_UPSTREAM_URL "$STAGING_API_URL"
  put_secret "$repo_root/apps/web" production API_UPSTREAM_URL "$PROD_API_URL"
fi

echo "Done. Optionally store the same value in GitHub for your records:"
echo "  gh secret set INTERNAL_API_KEY --body \"<your-key>\""
