#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

: "${MARKET_PROVIDER:=gateio}"
: "${MARKET_DATA_PORT:=3003}"
export MARKET_PROVIDER MARKET_DATA_PORT

cleanup() {
  trap - EXIT INT TERM
  kill "${APP_PID:-}" "${MARKET_PID:-}" 2>/dev/null || true
  wait "${APP_PID:-}" "${MARKET_PID:-}" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

npm run market-data &
MARKET_PID=$!
node .next/standalone/server.js &
APP_PID=$!

wait -n "$MARKET_PID" "$APP_PID"
exit $?
