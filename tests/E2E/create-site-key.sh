#!/usr/bin/env bash
# Creates a site key on a Cap Standalone server and prints CAP_ENDPOINT and CAP_SECRET_KEY, for the end-to-end tests:
#   export $(tests/E2E/create-site-key.sh http://localhost:3000 <ADMIN_KEY>)
# The CI appends its output to $GITHUB_ENV.
set -euo pipefail

url="${1:?Cap server URL, e.g. http://localhost:3000}"
admin_key="${2:?ADMIN_KEY of the Cap server}"

for _ in $(seq 1 30); do
    curl -sf "$url/health" > /dev/null && break
    sleep 2
done

login=$(curl -sf -X POST "$url/auth/login" -H 'Content-Type: application/json' \
    -d "$(jq -n --arg key "$admin_key" '{admin_key: $key}')")
# The dashboard API authenticates with base64({"token", "hash"}) of the session
bearer=$(jq -c '{token: .session_token, hash: .hashed_token}' <<< "$login" | base64 | tr -d '\n')
key=$(curl -sf -X POST "$url/server/keys" -H "Authorization: Bearer $bearer" -H 'Content-Type: application/json' \
    -d '{"name": "cap-bundle e2e"}')

echo "CAP_ENDPOINT=$url/$(jq -r .siteKey <<< "$key")/"
echo "CAP_SECRET_KEY=$(jq -r .secretKey <<< "$key")"
