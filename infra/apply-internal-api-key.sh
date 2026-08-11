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
# Reject empty / documented sample keys so local defaults never land on Workers.
case "$INTERNAL_API_KEY" in
  "" | "your-internal-api-key-change-me" | "dev-local-key" | "test-secret")
    echo "Replace the placeholder in .internal-api-key with a unique secret before running this script." >&2
    echo "Do not reuse local sample keys (dev-local-key / test-secret / example placeholders)." >&2
    exit 1
    ;;
esac
if [ "${#INTERNAL_API_KEY}" -lt 16 ]; then
  echo "INTERNAL_API_KEY must be at least 16 characters." >&2
  exit 1
fi

put_secret() {
  local app_dir="$1"
  local env_name="$2"
  local secret_name="$3"
  local secret_value="$4"
  printf '%s' "$secret_value" | (cd "$app_dir" && npx wrangler secret put "$secret_name" --env "$env_name")
}

echo "Uploading INTERNAL_API_KEY to api + web (staging + production)..."
for env_name in staging production; do
  put_secret "$repo_root/apps/api" "$env_name" INTERNAL_API_KEY "$INTERNAL_API_KEY"
  put_secret "$repo_root/apps/web" "$env_name" INTERNAL_API_KEY "$INTERNAL_API_KEY"
done

echo "Done. Optionally store the same value in GitHub for your records:"
echo "  gh secret set INTERNAL_API_KEY --body \"<your-key>\""
