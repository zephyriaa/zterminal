# ZTerminal — MEXC native execution implementation-agent prompt

**Future implementation artifact; do not execute during the documentation task.** Prepared 2026-10-05.

**Source completeness:** This is a complete usable **supplementary reconstruction**, organized from the recovered conversation requirements, the user's handoff and the inspected repository. It is not the complete verbatim original prompt. The exact original text is available only through part of section 8 in [the recovered excerpt](../architecture/mexc-source-recovered.md). All sections below are edited/reconstructed; no later original wording is claimed. [The architecture/playbook](../architecture/mexc-live-execution.md) is the companion design and acceptance contract.

Copy the following prompt into a coding-agent task only when implementation is authorized. Protocol values quoted as source-era facts are verification inputs, not instructions to hard-code them. Never activate live trading merely to demonstrate implementation.

---

## 1. Role, goal and required outcome

Act as the senior engineer implementing production-grade MEXC native strategy execution in the ZTerminal Windows application. This is a staged product implementation, not an API demo. Users must be able to add their own MEXC Access Key and Secret Key using native settings, store them locally with Windows-native security, test the connection read-only, run coded strategies in Paper or explicitly enabled Live mode, keep active strategies running when the app is minimized/closed to tray, and stop execution when they actually quit ZTerminal.

Recover safely from connectivity loss, exchange errors, stale data, WebSocket disconnects, worker crashes, Windows sleep/wake, engine crashes and ambiguous order outcomes. Strategy code must never receive credentials or signing capabilities. No credentials, signatures or authentication payloads may enter any cloud/web/browser, logs, diagnostics or strategy process. Fit existing architecture, preserve research behavior, and ship **Paper → Spot Live → Futures Live** behind separate evidence gates.

## 2. Inspect before changing code

Read applicable AGENTS.md and relevant native, research, persistence, security, microstructure and deployment contracts. Inspect nested repositories and working-tree changes; never overwrite unrelated work. Read current Next.js guides in `node_modules/next/dist/docs/` before any Next.js changes. Re-audit the architecture seam table instead of assuming its 2026-10-05 snapshot is current.

Inspect at minimum:

- Native Windows host in `apps/windows-host`, its supervision and bridge processes.
- Rust `zt-protocol`, `zt-core`, `zt-storage`, `zt-adapters`, and **existing `zt-risk`**, including Decimal sizing, risk IPC and kill switch.
- Active Python research system in `research/desktop`: `strategy(data, params)`, `zt.Strategy`, signal timing, hashes, SQLite archive, pairing API and process limits.
- Current market-data ownership and canonical event types in `docs/MICROSTRUCTURE_ARCHITECTURE.md`; actual Nautilus compatibility versus operational integration.
- Local/cloud settings serialization, exports/imports, telemetry, crash handling, authentication and account sync.
- Legacy ZS/web docs and actual source availability; historical `src/lib/strategy` references were absent during this audit.
- Legacy hosted Tauri preview: do not expand it into the native live product.

Report existing reusable components, missing capabilities, outdated claims and exact proposed changes. Do not build a second exchange, strategy or risk architecture without a documented necessity. This design proposes an extension to existing no-execution boundaries; it is not evidence that production trading is already authorized.

## 3. Ownership architecture

Implement a native execution engine with central credential vault, signer, exchange adapter, risk firewall, scheduler, order router, durable journal, REST reconciler, WS supervisor and strategy-worker supervisor. The engine is the exclusive saved-credential/signing owner. One authoritative engine owns an account; use crash-safe fencing/single-instance ownership so multiple windows cannot submit concurrently through independent ledgers.

Native UI sends local lifecycle/setup requests and receives sanitized state. Workers receive capability-limited broker IPC. Do not give the browser, web server, cloud, strategy worker or chart subscription a direct authenticated exchange client. Public market data and private trading are separate capabilities. Cloud metadata must remain optional and allowlisted, with no dependency in order decisions or secret storage.

## 4. Windows secret vault

Use **per-user DPAPI `CryptProtectData` / `CryptUnprotectData` CURRENT USER**. Never use `CRYPTPROTECT_LOCAL_MACHINE`, a plaintext fallback, browser storage or environment-secret convention. Store only an opaque credential reference in local SQLite. Put the encrypted key-plus-secret blob in a versioned private non-roaming local application directory with strict owner ACLs, separate from research/workspace/export/sync directories. **Never sync even encrypted credential blobs.** Do not use roaming Credential Locker as a substitute.

Validate ownership, inherited permissions, path safety/reparse handling and blob version; fail closed on tampering, missing vault state or decryption errors. Protect atomic-write temporary files with the same ACLs. Test interrupted save, replacement, deletion and migration. Replacement invalidates the previous credential version; deletion pauses dependent deployments and requires re-entry. Explain that local deletion does not revoke the exchange key.

After save, provide only **Replace** and **Delete**; no reveal/export saved secret API. The native paste controls receive credentials transiently, transfer them through protected local IPC and clear them. Minimize decrypted/signature lifetime and zeroize buffers where feasible; document unavoidable library copies and DPAPI roaming exceptions rather than overstating protection. A device-local product policy must reject credential roaming/export independently of DPAPI.

## 5. Secret exclusion and central redaction

Never put API keys, secrets, signatures, listen keys, authenticated request payloads or vault blobs in Supabase, Render, cloud sync/storage, web routes, browser/WebView storage, strategy code/context, command-line arguments, environment variables, logs, telemetry, crash reports, diagnostic bundles, reports or research exports. Exclude device-local credential references from portable metadata.

Centralize redaction for headers, URLs/query strings, request bodies, private WS frames, exception chains and worker stdout/stderr. Prefer allowlisted structured logs; disable raw sensitive transport logging. Do not let crash reporting upload sensitive memory. Use sentinel tests across all paths and serializers; unknown sync fields fail closed. Any retained raw payload must be justified, sanitized and strictly bounded.

## 6. Worker security and IPC

Never implement `strategy → MEXC SDK directly`. Implement `strategy → broker capability → authenticated local IPC → execution engine → risk/journal/scheduler/router → adapter`. Scope capabilities to deployment, account connection, product, symbols, mode, allowed operations and lifetime; revoke them on stop/kill switch. Do not trust worker-supplied identity or risk policy.

Use dedicated strategy workers, explicit handle allowlists, minimal non-sensitive environment, isolated directories, bounded IPC/messages/queues and Windows CPU/memory/process limits. A worker crash or infinite loop cannot kill other workers or the engine. No arbitrary HTTP/signing/vault operations are exposed through the broker. Authenticate local IPC peers and validate schema, ownership, quantities and capability before routing.

**Ordinary Python process separation and Job Objects are not an OS sandbox.** Same-user arbitrary Python may access files, DPAPI, processes and network outside the broker. Document trusted-local-code-only limitations prominently. Investigate Windows AppContainer/restricted tokens with deny tests for vault files, process inspection, IPC and network. Do not claim untrusted downloaded strategies are safe unless actual isolation is implemented and tested. Keep that feature disabled otherwise.

## 7. Exchange abstraction and exact contracts

Extend or introduce `ExchangeAdapter`, `MarketDataAdapter`, `TradingAdapter`, `AccountAdapter` using existing types where appropriate. Account methods include balances, positions, open/historical orders and fills. Trading methods include place/cancel/deployment-owned cancel-all, query and modification only where supported. Market methods include required trades, tickers, books, bars and history/subscriptions.

Normalize `Order`, `Fill`, `Position`, `Balance`, market events, `SymbolInfo` and exchange errors with account/product/venue/deployment provenance. Preserve canonical microstructure event types rather than creating redundant wrappers. Errors distinguish definite rejection from unknown outcome, permission/auth, filters, rate limits, stale data and protocol failure.

Use deterministic Decimal arithmetic/exact fixed point and decimal-string wire fields, not floating-point money. Validate price tick, quantity step, min/max quantity, min notional, multipliers/units, supported types and symbol trading status. Reject unsafe rounding, stale metadata, overflow/non-finite values and unsupported order semantics. Never silently round toward greater exposure.

## 8. Strategy compatibility and deployment lifecycle

Keep the same supported strategy moving **backtest → paper → live** with minimal changes. The current batch Python signal API is not already a streaming broker runtime. Add a versioned causal adapter or compatible event contract; preserve next-open backtest behavior, source hashes and input provenance, and document live fill differences. Never feed future bars to live/paper logic. Arbitrary full-history Python can still introduce look-ahead bias; do not promise that shifting signals proves causality.

Conceptual broker methods may include orders.place/cancel, owned cancel-all, sanitized account balances/positions and market subscribe/history. Conceptual hooks may include start, bar, order update, fill, position update, timer and stop. Extend existing equivalents and provide migration/parity tests; do not invent an incompatible new strategy language simply because these names look clean.

Persist `StrategyDeployment`: source/version hash, engine version, params, symbols, account connection, venue/product, mode, risk policy and state. Model validating, running, degraded, reconciling, paused, stopping, stopped and failed, with separate paper/live activation. Loading a workspace/import, reconnecting, waking or restarting must not silently turn on live trading.

## 9. Native exchange setup

Add native **Settings → Exchanges → MEXC** with transient key/secret input, product capability selection, read-only Test connection, save, replace/delete and truthful connection health. Verify real permissions; UI selections do not grant exchange permissions. Require least privilege and no withdrawal capability. Explain IP restrictions/expiry accurately. Never display a tested connection as live-enabled. Tests with real credentials require explicit authorized use and must never log credentials.

## 10. Current official protocol verification

Before implementing each endpoint, read the current official MEXC documentation and changelog, record URL/date/schema or revision, verify endpoint availability and key permissions, and create official-shaped fixtures. Do not rely on memory, stale unofficial SDKs or unsupported WEB/APP authentication workarounds.

Source-era facts to verify:

- Spot REST `https://api.mexc.com`; `X-MEXC-APIKEY`, `timestamp`, `recvWindow`, HMAC-SHA256; `newClientOrderId` and query support/limits.
- Futures REST `https://api.mexc.com`; `ApiKey`, `Request-Time`, `Signature`, optional `Recv-Window`; `externalOid`, native order-side semantics and ID constraints.
- Futures WS `wss://contract.mexc.com/edge`; its private auth/subscriptions remain distinct from REST domain migration.
- Spot WS protobuf using official schemas, stated 24-hour connection lifespan and 60-minute listen-key validity/renewal; verify current secure endpoint/channel names.
- Source-era Futures placement limit 4 requests/2 seconds and non-IP-bound key expiry 90 days; verify exact per-endpoint/account/IP weights and current permission constraints.
- Source-era lack of sandbox and Spot `/api/v3/order/test` validation without matching. This is not a complete simulation environment and does not justify unapproved authenticated tests.
- Spot timeout/5xx unknown execution must be reconciled, never assumed failed.

Use [Spot introduction](https://www.mexc.com/api-docs/spot-v3/introduction), [Futures integration guide](https://www.mexc.com/api-docs/futures/integration-guide), [Futures changelog](https://www.mexc.com/api-docs/futures/update-log), and the official references linked in the architecture. Public documentation checks there are partial; reverify every implemented protocol detail. Build separate exact Spot/Futures signers with deterministic vectors covering query/body encoding, methods, empty/null/path parameters, timestamp drift and receive-window units.

## 11. Durable execution ledger before network send

Design a versioned local SQLite execution ledger, separate from workspace snapshots and portable research exports. Store connections with opaque vault refs, deployments, `OrderIntent`, attempts, confirmed exchange orders, fills, reservations, checkpoints and redacted lifecycle events. Prove transaction durability and migration/recovery behavior; the existing workspace journal is not an order ledger.

Allocate a globally unique persistent client ID, account/product/deployment ownership and risk reservation. **Durably commit the OrderIntent transaction BEFORE any network transmission.** Block send on commit/flush failure, disk full or storage corruption. Do not reuse IDs after restart, restore, deletion or sequence reset. Use Spot `newClientOrderId` / Futures `externalOid` where officially supported; they do not establish exchange exactly-once semantics by themselves.

Persist acknowledgement/exchange ID afterward. Timeout, 5xx, socket failure or lost acknowledgement becomes UNKNOWN. A crash anywhere between commit, send, response and acknowledgement persistence requires conservative reconciliation. Never blindly resubmit or allocate a fresh ID to bypass uncertainty.

## 12. Exchange-authoritative reconciliation

On startup/reconnect/wake, worker or engine crash, auth recovery and ambiguous response, reconcile orders, fills, balances, positions and ownership before resume. Use verified client-ID queries plus bounded historical/open-order/fill coverage. A delayed not-found response does not prove non-execution. Quarantine unresolved ambiguity, retain pending risk and expose it to the user; do not fabricate a rejection/success.

Persist exchange IDs and stable fill dedup keys with account/product scope. Apply fill/account changes and dedup/checkpoints transactionally. Test duplicates, out-of-order events, partial fills, cancel/fill races, ack/event races, pagination and history gaps. Snapshot/buffer/replay rules must prevent older snapshots erasing later fills; protocols without sequencing need extra REST convergence checks. Manual or externally created orders must remain distinguishable and cannot be canceled as deployment-owned.

Any resend after uncertainty must have a documented tested proof that it cannot duplicate an already executed economic intent, or use explicit resolution without automatic retransmission. Do not release reservations merely because a timeout expired.

## 13. Central rate scheduler

One account/connection scheduler aggregates all strategies, UI, auth lifecycle and reconciliation traffic and applies endpoint weights and relevant IP/account limits. Reserve capacity for cancels and risk/recovery, bound queue depth, expire stale signals and recheck health/risk at dispatch. Strategy workers cannot bypass the limiter.

On `429`, degrade and apply bounded backoff/jitter and documented retry-after handling. No independent retry storms. Use intent outcome classification before any submission retry. Cancellation priority does not guarantee cancellation during an outage; surface failures honestly.

## 14. WebSocket recovery

Implement explicit DISCONNECTED, CONNECTING, AUTHENTICATING, SYNCING, HEALTHY, DEGRADED, RECONNECTING and FAILED states. Handle heartbeats, ping/pong, planned rotation, unexpected disconnect, stale streams, auth expiry, renewal, re-subscription, duplicate/out-of-order/lost messages, sequence gaps, buffer overflow and snapshot recovery. TLS endpoints must be allowlisted.

Decode Spot protobuf using official versioned schemas and generated decoding, not string hacks. Renew/rotate user-data listen keys before expiry using verified timing. Implement verified Futures private authentication and subscriptions. A socket connection alone cannot make data/account state healthy; REST reconciliation and fresh complete state gate resumption. Preserve feed-quality epochs and actual receive/availability timing.

## 15. Central risk firewall

Extend audited `zt-risk` primitives. Every order, including native UI orders, passes central authoritative account risk, exact symbol filters, broker capability, durable intent and scheduler. Enforce max order notional, max aggregate position notional, symbols, leverage, daily loss, orders/minute, simultaneous positions, spread/slippage, stale-data gates and global kill switch.

Use confirmed + pending + unknown exposure across deployments. Reserve atomically so parallel strategies cannot exceed limits. Define persistent daily-loss reset/timezone, fees and realized/unrealized P&L. Missing equity/prices, stale state or invalid policy fails closed. Workers cannot supply trusted equity or policy. Verify reduction semantics and ownership before treating an action as risk-reducing. Kill switch blocks new exposure/revokes worker order capability; cancellation behavior is explicit, never automatic liquidation.

## 16. First-class paper mode

Build Paper before live. Use real permitted MEXC public data and internal simulation of orders/fills, fees, finite liquidity/partial fills, balances, positions, latency and slippage. Apply the same broker contracts, filters, risk, journal and deployment lifecycle with a paper adapter. Simulated fills stay visibly labeled even with real prices. Use deterministic seeds/configuration and record versions/provenance; document unmodeled effects.

Paper has no dependency on live credentials and cannot call private trading endpoints. Mode selection is engine-owned and cannot be spoofed by IPC/import/sync. Unsupported Futures funding/margin/liquidation semantics must remain disclosed and block corresponding live readiness; do not invent realistic results.

## 17. Spot then Futures

Spot implements verified symbol discovery/filters, account balances, orders/query/cancel, fills, private user data and required public streams. Pass deterministic signing, journal/reconciliation, rate, risk, health and native lifecycle gates before separately authorized bounded live validation.

Architect Futures in parallel conceptually but activate it only after independent validation. Model isolated/cross margin, leverage, long/short, opening/closing, one-way/hedge, reduceOnly, position IDs, liquidation/margin state, TP/SL/conditional orders, funding and contract multipliers/specifications. Use a tested intent-to-native-side matrix; BUY/SELL cannot safely encode all Futures meanings. Verify exchange account modes, reject incompatible changes, and prevent partial close from unexpectedly reversing. Unsupported mappings fail closed.

## 18. Tray and safe shutdown

The native app owns engine lifetime; do not attach it to browser/chart demand. Minimize or **close to tray** continues active strategies while ZTerminal remains running. Show visible active deployment count/status and reopen/quit controls. **Quit ZTerminal terminates the engine and workers**. No Windows service, hidden restart after Quit or automatic login/start trading in the initial release.

Stop accepting intents, revoke capabilities, persist stopping/uncertain state, handle bounded in-flight reconciliation, perform only explicitly configured cancellation of strategy-owned resting orders, then terminate workers/streams/engine. Bound shutdown if network is unavailable and report unresolved cancel results. **Never automatically liquidate positions on exit.** Warn that positions and exchange-native resting/conditional orders can remain active/fill after exit. Keep local secret deletion, exchange revocation, strategy stop, app quit and liquidation as distinct actions.

## 19. Failure behavior

- Internet lost: stop new orders, preserve unknown sends, reconcile before resume.
- Stale/gapped market feed: stop new decisions/orders, show truthful status.
- Private WS lost: degrade and REST reconcile before healthy resume.
- Expired/revoked auth: pause deployments, require replacement/recovery, no retry storm.
- Worker crash/hang: isolate, reconcile owned activity before policy-controlled restart.
- Engine crash: fence prior owner, recover ledger, reconcile before explicit live restart.
- Sleep/wake/clock jump: expire queued work, reset health/reconcile, **do not replay missed signals**.
- Storage corruption/full/flush failure: block submissions, retain evidence, do not replace journal with empty state and resume.

## 20. Tests required before live gates

Start with deterministic local mocks, synthetic secret sentinels and official-shaped fixtures. Real credential/test-order/live calls are separate explicit authorized validations. Record exact build/commit, OS/user context, fixtures and evidence.

Required test families:

1. Spot/Futures deterministic signing; exact encoding, empty/null/path inputs, time windows and redacted failures.
2. Decimal/filter/multiplier/unit boundaries, unsupported symbols/types, stale metadata, no exposure-increasing rounding.
3. Journal process-kill windows before commit, after commit/before send, after send, after response/before ack persistence and during fills; disk/flush failure, restart/migration/restore, globally persistent ID uniqueness.
4. Accepted-but-timeout/5xx reconciliation without duplicate economic execution, delayed not-found, fills/partial fills, manual ownership, pagination, cancel/fill race, quarantine and retained reservations.
5. Account-wide concurrent rate scheduling, cancel/recovery reserve, endpoint weights, 429 degradation/backoff, expired queues and no bypass/retry storm.
6. WS heartbeat/rotation/listen-key expiry/renewal, protobuf/schema mismatch, auth failure, duplicates/out-of-order/loss/gaps, snapshot race and resumption gate.
7. Every risk limit, concurrent exposure reservation, daily-loss persistence, unknown exposure, stale/missing account/prices, kill switch and forged worker policy.
8. Worker crash/hang/limits, unauthorized IPC peer/account/product/mode/deployment, malformed/oversized payloads, revoked capability, env/handle isolation and explicit OS-sandbox limitation/proof.
9. DPAPI same-user round trip and different-user failure; forbidden machine scope; strict ACLs, unsafe paths, tamper/missing/version errors, interrupted atomic writes, replace/delete/migration and plaintext exclusion from SQLite/temp files.
10. Sentinel redaction in transport/error/worker/telemetry/crash/report paths and absolute exclusion of credentials/blobs/refs from cloud/browser/workspace/import/export.
11. Tray continuing execution and visible state; Quit stops engine/workers without orphans; in-flight shutdown/cancel failure, owned-only cancels, no automatic liquidation.
12. Network/auth/private WS/stale feeds, worker/engine crash and sleep/wake without signal replay or premature resumption.
13. Backtest/paper/live compatibility and causal timing differences; zero private trading in paper; explicit activation and spoof-resistant mode boundaries.
14. Futures complete mode/direction/open-close/reduceOnly matrix, leverage/margin/liquidation/position IDs, conditional orders, contract units, funding, partial close and unsupported-feature rejection.

## 21. Delivery phases and acceptance

Deliver reviewed audit/contracts first, then native vault/IPC/ledger/redaction, then paper, then Spot readiness, then bounded explicitly activated Spot rollout, then independent Futures readiness/rollout. Keep live disabled when any required gate lacks evidence. Do not skip paper because a signing request works. Scope each phase clearly and report unfinished work honestly.

Acceptance requires native store/test/replace/delete without reveal; no secrets outside the native boundary; compatible honest research/paper behavior; explicit separate live activation; visible health/risk/tray status; durable pre-send intent; no blind repeat after ambiguous execution; no double-counted fills; exchange-authoritative recovery; central limits; safe Quit without liquidation; and passing Windows DPAPI/ACL, redaction/sync, recovery and Futures semantic evidence for enabled modes. Trust/sandbox limitations and unmodeled simulator effects must be clearly shown. No production-ready claim without all enabled-mode gates.

Rollback disables new live capability and pauses deployments while preserving journal/reconciliation evidence. It does not undo existing exchange positions or orders. Never hide unknown exposure to make acceptance pass.

## 22. Final coding-agent report

Return exact files changed, integration decisions, delivered phases, tests actually run/results, protocol URLs/retrieval dates, Windows security/lifecycle evidence, pending gates and known limitations. Identify any required user action precisely. No credentials or raw authenticated payloads in the report. Explain live activation/stop/Quit and residual exchange orders/positions. Do not state live production readiness or complete OS isolation based only on mocks or process limits.

---

End of reconstructed implementation prompt. The missing original continuation remains unrecovered; this artifact supplies a usable plan without claiming its wording came from that continuation.
