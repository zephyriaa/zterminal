#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

: "${MARKET_PROVIDER:=gateio}"
: "${MARKET_DATA_PORT:=3003}"
: "${APP_PORT:=3000}"
: "${PORT:=8080}"
export MARKET_PROVIDER MARKET_DATA_PORT APP_PORT PORT

cleanup() {
  trap - EXIT INT TERM
  kill "${PROXY_PID:-}" "${APP_PID:-}" "${MARKET_PID:-}" 2>/dev/null || true
  wait "${PROXY_PID:-}" "${APP_PID:-}" "${MARKET_PID:-}" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

./node_modules/.bin/tsx mini-services/market-data/index.ts &
MARKET_PID=$!

# Render injects HOSTNAME for the container. Bind explicitly to all interfaces so Caddy can reach Next.js via 127.0.0.1.
PORT="$APP_PORT" HOSTNAME="0.0.0.0" node .next/standalone/server.js &
APP_PID=$!

caddy run --config Caddyfile --adapter caddyfile &
PROXY_PID=$!

wait -n "$MARKET_PID" "$APP_PID" "$PROXY_PID"
exit $?
