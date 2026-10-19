# Phase 03 handoff — local delivery verified; full acceptance blocked

18 October 2026, Asia/Baku. The user instructed “to phase 3”, authorizing this phase despite Phase 02's incomplete acceptance prerequisite. Phases 00–03 remain BLOCKED. Phase 04 was not started. No deployment, publication, staging, commit, hosting/account mutation or trading occurred.

## Revalidated boundary

Fresh public read-only WebSocket handshakes reproduce the deployed failure: the slash Socket.IO path returns **308**, the no-slash path **404**, and `/api/market-data/health` **503**, including a non-JSON upstream parse error. See `evidence/deployed-readonly-before.json`. This does not imply an exchange-wide outage or identify the hidden production hosting cause.

Checked-in Wrangler/OpenNext configuration serves the web Worker and custom domain without a gateway target. Separately, Docker/start-production.sh/Caddy describe the existing long-running Node gateway behind a same-origin proxy. The actual production gateway host, infrastructure owner account, server-side logs and release identity remain unknown. Source configuration suggests a missing ingress/gateway boundary; it does not prove deployed environment values. Removing the redirect alone cannot restore that service.

The existing gateway remains the live owner. The prepared configuration supports its existing Node/Caddy layout or an explicitly reviewed separate origin for that same gateway. No stack migration, extra streaming service or dependency was introduced.

## Changes

- Optional `NEXT_PUBLIC_MARKET_GATEWAY_URL` selects an unauthenticated HTTP(S) **origin** at web build time. CSP permits that exact HTTP/WebSocket origin; credentials, paths, queries and fragments are refused. Server-side `MARKET_GATEWAY_URL` must reach the same gateway for health/catalogue, and its `ALLOWED_ORIGIN` must permit the web origin. The example documents this without selecting/provisioning a host. Production should use a reviewed HTTPS origin.
- Same-origin Caddy remains the default and must own both Socket.IO paths before Next. Client/server now use the no-added-slash option; the local server accepts both slash/no-slash paths with 101. Caddy respects existing MARKET_DATA_PORT/APP_PORT overrides. Next's general slash policy is unchanged. The development CSP now permits the localhost:3003 gateway that the client actually uses; production remains scoped to self/configured origin. Proxy assembly itself is unverified.
- Both existing books now retain an early snapshot and bridge it when its delta arrives. The first real local probes reproduced trades/quotes without depth; a focused ordering regression failed before this repair. Gaps invalidate readiness, levels and quotes immediately. Reconstruction stays sequence validated; no synthetic depth was added.
- Snapshot completions/retry callbacks cannot overwrite a replacement book/subscription/socket. Binance rebuild ownership now uses book instances so an old request cannot block a new subscription to the same symbol.
- Gate now exposes per-symbol message/depth times and book readiness. Both adapters derive health from the requested symbol, socket, fresh data and book integrity. An open socket, heartbeat, another market or historical REST trade seed cannot certify LIVE. REST seeds remain tagged; live analytics exclude them. Client source timestamps use exchange trade/quote times, rather than health receipt time.
- Upstream disconnects invalidate books; replaced socket callbacks are rejected. Public REST calls have 10-second bounds. Snapshot work is coalesced and retries back off after failures/rate limits. Thirty seconds of heartbeat silence terminates the upstream socket. Reconnect delay/jitter is bounded and no-subscriber shutdown stops retries. Gate/Binance send actual exchange unsubscriptions.
- The canonical shared client keeps one subscription manifest per connection and resubscribes once after reconnect. It has eight automatic reconnect attempts with backoff; online/foreground signals can resume a disconnected/exhausted connection. Offline clears it. Health acknowledgements have a 3-second timeout; old health expires independently of socket openness. Disconnect/gap/foreground checks withhold old depth. Final cleanup removes network/store/socket listeners and sets DISCONNECTED. Only the active primary instrument projects health into the workspace connection state.
- Health fetch/body work has a 5-second timeout and 64 KiB limit, refuses redirects/non-JSON/non-success responses, validates a public schema and strips arbitrary upstream diagnostics. Invalid/stale LIVE claims are downgraded. Process liveness stays separate from usable feed state. Subscription validation rejects malformed event types/foreign venues; same-symbol updates do not consume extra slots; cancelled/failed startup work is cleaned up. Active instrument health is emitted every two seconds.

## Verification

| Check | Result and actual scope |
| --- | --- |
| Before repair | Three initial regressions failed. Snapshot-before-delta and development CSP regressions also failed before their fixes; separate logs retained. |
| Full tests | **232 passed, 0 failed**, including ten Phase 03 tests. `evidence/typescript-tests.log`. |
| Final affected checks | **15 passed** after final visibility/disposal edits. `evidence/final-focused-tests.log`. |
| Typecheck/lint | Exit 0: all-source `tsc --noEmit --incremental false`, scoped ESLint and final hook/test lint. Exact commands/exits in `evidence/final-checks.json`. |
| Protocol fixtures | Actual isolated mock gateway: both paths return 101; simulation-tagged trade/quote/depth; malformed/foreign requests refused; unique-symbol limit and same-symbol update; reconnect/unsubscribe cleanup. This is explicit simulation. |
| Shared client fixture | Actual Socket.IO transport against controlled events: two consumers share one subscription, transport loss causes one resubscription, offline/online/foreground signals recover, repeated state events do not duplicate subscriptions, final disposal is DISCONNECTED. EventTarget signals are fixtures, not a browser. |
| Integrity/fault fixtures | Gap invalidation, late-delta bridging, stale-health expiry, 429 backoff, late unsubscribed snapshot refusal and heartbeat timeout/monitor cleanup. |
| Final real Gate sample | Current local Node gateway, BTC_USDT, ten seconds: **101; 128 trades, 135 quotes, 66 reconstructed depth updates**. Gateway health LIVE; current source health route invoked in Node against it returns **200/LIVE** after parsing/freshness validation. |
| Final real Binance sample | Current local Node gateway, BTCUSDT, ten seconds: **101; 19 trades, 726 quotes, 56 reconstructed depth updates**. Gateway and parsed source health route agree **LIVE**, health HTTP **200**. |
| Production | Read-only FAIL: 308/404/503. No release or deployed success. |
| Browser/candidate | BLOCKED / NOT RUN. Harness doctor has no supported Chrome, daemon or active connection. Caddy/Docker executables unavailable; no assembled proxy upgrade, release build, screenshots or rendered journey claim. |
| Preservation | **1,446 baseline files**; index/unrelated work and original audit/plan/Phases 00–02 unchanged. Thirteen existing files changed; one test file added. Raw before bytes, patch, hashes and original newline conventions retained. CRLF-aware diff check passes. |

Initial real no-depth probes are retained in `evidence/local-live-gateways.json`; first successful 20-second probes in `local-live-gateways-after.json`; final ten-second probes and parsed API observations in `local-live-gateways-final.json`. The reproducible driver is `evidence/probe-live.cjs`. Local source invoked in Node is not browser, assembled candidate or deployed evidence. Real delivery was observed only for the named instruments/sample windows.

Source HEAD remains `80124f17ae500565fe4bb7a88ad44f4b693d4e02`, plus the existing dirty checkout and source-manifest hashes. Runtime identities are recorded separately. No Helper was executed. All task-created gateway processes/sockets were stopped; no personal service, storage, account, archive or tab was modified.

## Remaining gates and continuation

1. Identify the authorized production Node gateway host/owner and upstream route, configure its web-origin policy and both web gateway settings consistently, then prove 101 plus usable messages through the assembled candidate's actual proxy. Server logs/deployed identity are unknown. Hosting provisioning and release were not authorized.
2. Verify mounted charts/books/overlays through switching, offline/online, foreground recovery, stale expiry and sustained reconnects. The earlier isolated Chromium launch was rejected by automatic approval review with “blocked by policy”. This phase's Harness doctor still has no supported connection; no unchanged launch retry, alternative driver or bypass was attempted. Fixtures do not close browser acceptance.
3. Bybit/Coinbase/OKX have no live adapter in this gateway. Their explicit refusal is containment, not delivered integration. Wider discovered universes, full numerical book/analytics checks and long-duration outages/load remain unresolved. Upstream retries continue at bounded backoff while subscribers remain. Phase 11 owns the complete book/analytics journey.
4. No application/Cloudflare/Caddy candidate was assembled. Phase 18 remains the candidate gate; Phase 19 requires authorization for the exact reviewed candidate and target.

The full ledger preserves all **252 originals**, updates **17 assigned Phase 03 assertions** (eight PARTIAL, nine unsupported-venue BLOCKED), and adds narrow A088/A094 live-depth cross-checks without changing their owning phase's status. F03 remains unresolved. Fresh deployed failure evidence is separate from local live success. Earlier acceptance gates remain blocked.

The next planned phase is **04**, whose normal Phase 02 prerequisite remains blocked. No next phase is fully dependency-ready. A direct user instruction may authorize the next local implementation scope without retroactively closing prerequisites. Stop and wait; do not start Phase 04 automatically.

Official references: [Socket.IO client options](https://socket.io/docs/v4/client-options), [server options](https://socket.io/docs/v4/server-options). Installed Next.js route-handler, environment-variable and slash-policy guides were read. REA instructions were read; source tracing and direct HTTP/protocol observations answered available questions, while hidden hosting/server logs remain unknown.

Deliverables: HANDOFF.md, repair-ledger.json/CSV, finding-ledger.json, stage-ledger.json, coverage.json, phase03.patch, preservation/runtime/source evidence and artifact manifest in this separate ignored phase directory.
