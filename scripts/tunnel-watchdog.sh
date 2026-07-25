#!/usr/bin/env bash
# Keeps the public API reachable: checks the cloudflared quick tunnel every
# minute; on failure, restarts it and publishes the new hostname to the site's
# runtime config (api-config.js/.json on S3) — no rebuild required.
set -u
STATE=/tmp/livingbook-tunnel-url
LOG=/tmp/livingbook-tunnel-watchdog.log
BUCKET=s3://livingbook.masky.ai
DIST=E2DGNXZJVOM8A

log() { echo "$(date '+%F %T') $*" >> "$LOG"; }

healthy() {
  local url
  url=$(cat "$STATE" 2>/dev/null) || return 1
  [ -n "$url" ] || return 1
  curl -s --max-time 10 "$url/api/books" -o /dev/null -w '%{http_code}' | grep -q 200
}

rotate() {
  log "tunnel unhealthy — rotating"
  pkill -f 'cloudflared tunnel' 2>/dev/null
  sleep 2
  nohup cloudflared tunnel --url http://localhost:8787 > /tmp/livingbook-tunnel.log 2>&1 &
  for _ in $(seq 1 12); do
    sleep 5
    NEW=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' /tmp/livingbook-tunnel.log | head -1)
    [ -n "$NEW" ] && break
  done
  [ -n "${NEW:-}" ] || { log "rotate FAILED: no hostname"; return 1; }
  echo "$NEW" > "$STATE"
  printf "// Runtime API endpoint (auto-managed by scripts/tunnel-watchdog.sh)\nwindow.__API__ = '%s';\n" "$NEW" > /tmp/api-config.js
  printf '{"apiUrl":"%s"}\n' "$NEW" > /tmp/api-config.json
  aws s3 cp /tmp/api-config.js "$BUCKET/api-config.js" --quiet
  aws s3 cp /tmp/api-config.json "$BUCKET/api-config.json" --quiet
  aws cloudfront create-invalidation --distribution-id "$DIST" --paths '/api-config.js' '/api-config.json' > /dev/null
  log "rotated to $NEW"
}

log "watchdog started"
while true; do
  healthy || rotate
  sleep 60
done
