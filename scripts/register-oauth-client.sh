#!/usr/bin/env bash
# Register the LivingBook OAuth client with Masky (one-time).
# Requires MASKY_API_KEY (a first-party mky_… key from https://masky.ai/developer).
#
# Usage:
#   MASKY_API_KEY=mky_... ./scripts/register-oauth-client.sh [domain ...]
#
# Domains default to localhost (dev) + livingbook.app (prod placeholder).
# The printed clientId goes into web/.env.local as VITE_MASKY_CLIENT_ID.
# The clientSecret is shown ONCE — store it in a secret manager (AWS SSM /
# Secrets Manager) for backend/service use; the web app itself uses PKCE and
# never needs the secret.
set -euo pipefail

if [[ -z "${MASKY_API_KEY:-}" ]]; then
  echo "error: MASKY_API_KEY is not set (get one at https://masky.ai/developer)" >&2
  exit 1
fi

domains=("$@")
if [[ ${#domains[@]} -eq 0 ]]; then
  domains=(localhost livingbook.app)
fi
domains_json=$(printf '"%s",' "${domains[@]}")
domains_json="[${domains_json%,}]"

curl -s -X POST https://masky.ai/api/oauth/clients \
  -H "Authorization: Bearer $MASKY_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"LivingBook\",\"redirectDomains\":$domains_json,\"scopes\":[\"profile\",\"avatars:read\",\"generate\"]}"
echo
echo "Put clientId into web/.env.local:  VITE_MASKY_CLIENT_ID=mkc_..."
echo "Store clientSecret (shown once) in AWS Secrets Manager for the backend."
