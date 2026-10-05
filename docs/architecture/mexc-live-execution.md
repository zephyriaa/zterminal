# MEXC native live execution architecture and implementation playbook

**Status: proposed design; documentation only.** Prepared 2026-10-05. No MEXC execution, credential vault, tray trading lifecycle, or production authorization is delivered by this record. Rollout requires the acceptance gates below and explicit user activation. Never run this plan as an instruction to place orders merely because it exists in the repository.

**Development update:** An internal vault/ledger/offline-paper foundation now exists. See [implementation status and remaining gates](../implementation/mexc-execution-foundation-status.md). This design document does not itself deliver the feature; live execution and native user workflows remain gated.

## 1. Provenance and scope

This design carries forward the architecture and requirements from **MEXC API Implementation Playbook**, ChatGPT conversation `6ac3954e-8404-83ed-89d0-b2ccc4f72f89`, plus the user's documentation handoff. [Recovered source](mexc-source-recovered.md) preserves the exact available 20,000-character assistant excerpt. It ends during prompt section 8; the remaining original prompt could not be recovered. The [complete usable implementation prompt](../implementation/mexc-live-execution-agent-prompt.md) is an explicitly reconstructed supplementary artifact, not a verbatim original. Sections here organize the recovered requirements and add repository-specific engineering decisions and acceptance detail.

The invariant is **local execution, local secrets, cloud metadata only**. The installed native Windows application owns account connectivity, signing, order routing, durable execution history, market-data health, reconciliation, risk, and worker supervision. Cloud services are optional metadata services; they never authorize an order or hold exchange credentials. Metadata sync is independently gated and does not follow automatically from this design.

This proposal extends the exclusions in [the native product boundary](../windows/LOCAL_FIRST_PRODUCT_BOUNDARY.md) only as future design. [PROJECT_RULES](../PROJECT_RULES.md) and [SECURITY](../SECURITY.md) describe an earlier web/research generation, including server environment secrets. That storage approach **must not be copied for native MEXC credentials**. Their existing no-production-trading boundary remains true until a separately validated implementation is released. Existing public provider capability does not imply private trading capability.

## 2. Repository audit and integration seams

Inspection covered the project root, tracked documentation, native host, Rust workspace, Python helper, legacy wrapper, and repository metadata. The root `AGENTS.md` is the only discovered AGENTS file; recursive discovery found only the root `.git`, with no nested repositories or registered submodules. No existing MEXC documentation or tracked MEXC implementation was found. Existing unrelated working-tree modifications were left intact. The repository's `.agents/rules/deployment.md` describes the coding deployment workflow; this documentation task does not implement or deploy a trading feature.

| Existing seam | Inspected location | Reuse and limitation |
| --- | --- | --- |
| Native shell | [main.cpp](../../apps/windows-host/src/main.cpp), [host README](../../apps/windows-host/README.md), local scene/catalog/Monte Carlo bridge files alongside it | Native Win32/Direct3D target. Add engine/tray supervision to this product in future; the README is a Phase 0 baseline and is not a complete inventory of subsequent bridges. No audited MEXC/tray execution guarantee. |
| Native data contracts | [zt-protocol](../../crates/zt-protocol/src/lib.rs), [zt-core](../../crates/zt-core/src/lib.rs) | Reuse provenance, environment, exact units and verified freshness; version execution contracts without treating historical bars as executable live events. |
| Public adapters | [zt-adapters](../../crates/zt-adapters/src/lib.rs), [direct-provider contract](../windows/DIRECT_PROVIDER_ADAPTERS.md) | Current scope explicitly excludes credentials and execution. Extend through a reviewed execution boundary, not by giving public/chart adapters secrets. |
| Local persistence | [zt-storage](../../crates/zt-storage/src/lib.rs), [persistence contract](../windows/LOCAL_PERSISTENCE_CONTRACT.md) | Segment store and flushed workspace journal are not an order ledger. Design a versioned SQLite execution journal with proven durability and migrations; do not call the existing workspace journal an implemented order WAL. |
| Existing risk primitives | [zt-risk](../../crates/zt-risk/src/lib.rs), [gatekeeper](../../crates/zt-risk/src/gatekeeper.rs), [IPC structs](../../crates/zt-risk/src/ipc.rs), [sizing](../../crates/zt-risk/src/sizing.rs) | Decimal sizing, kill switch, drawdown, request window and gross/net collars exist. Audit and extend them. Current request fields do not constitute authoritative account reconciliation, a complete venue scheduler or a deployed broker. Some files have pre-existing local modifications. |
| Active local strategy system | [zterminal.py](../../research/desktop/zterminal.py), [engine.py](../../research/desktop/engine.py), [server.py](../../research/desktop/server.py), [archive.py](../../research/desktop/archive.py), [process_limits.py](../../research/desktop/process_limits.py), [helper contract](../../research/desktop/README.md) | `strategy(data, params)` returns aligned `zt.Strategy` signals. SQLite archives, source hashes, paired loopback API, child-process limits and next-open research execution exist. The helper stops jobs on close and does not execute broker orders. Its web pairing endpoint must not become an authenticated trading/signing bridge. |
| Event research direction | [MICROSTRUCTURE_ARCHITECTURE](../MICROSTRUCTURE_ARCHITECTURE.md), [Nautilus compatibility](../../research/desktop/market/nautilus_compat.py) | Preserve canonical event types, decimal-string wire values and feed-quality epochs. Nautilus compatibility is not evidence of an operational native live node. Avoid a second incompatible event model. |
| Legacy web/strategy docs | [ARCHITECTURE](../ARCHITECTURE.md), [STRATEGY_LANGUAGE](../STRATEGY_LANGUAGE.md), [Gate integration](../GATEIO_INTEGRATION.md) | Historical ZS compiler/runtime paths in those docs do not exist in the inspected `src/lib/strategy` tree. Do not promise a live ZS runtime based on stale references. Gate public REST/WS patterns may inform recovery, but web demand lifetime cannot own continuous trading. |
| Hosted desktop preview | [src-tauri](../../src-tauri/Cargo.toml), root [Cargo workspace](../../Cargo.toml) | Explicitly excluded legacy Tauri package. Do not add MEXC credentials or capabilities to its hosted/browser surface. |
| Web account/cloud state | [cloud readiness](../CLOUD_SYNC_AUTH_READINESS.md), [auth audit](../AUTH_AUDIT.md) | Audit actual serializers and sync routes before introducing connection/deployment metadata. Keep native credential files, references, journals and auth payloads out of generic export/sync paths. |

Before implementation, repeat this audit against the then-current tree, record exact commit and relevant dirty files, and read applicable AGENTS instructions. Read `node_modules/next/dist/docs/` before any Next.js changes. Extend existing abstractions; do not assume this snapshot describes future code.

## 3. Ownership and process boundaries

```text
Native Windows settings and strategy UI
  | local restricted IPC: setup / lifecycle / sanitized status
  v
Native Execution Engine (one authoritative owner per account)
  + Credential vault -> request signer -> MEXC adapter -> MEXC TLS endpoints
  + Feed/WS supervisor -> normalized market/account state
  + Durable execution journal <-> REST reconciler
  + Risk firewall -> account scheduler -> order router
  + Worker supervisor -> capability broker IPC -> separate strategy workers

Optional cloud: explicitly allowlisted non-sensitive metadata only
```

The execution engine exclusively retrieves saved credentials and signs requests. The native setup UI necessarily receives pasted credentials briefly; it transfers them through protected local IPC into the vault, clears input buffers, and exposes no saved-secret retrieval API. Strategies receive broker capabilities scoped to deployment, connection, product, symbols and mode. IPC authenticates the local peer, has owner-only access control, bounded message size/queues, versioned envelopes and explicit expiry/revocation. A worker cannot claim another deployment/account identity in its payload. Reject unknown operations and malformed inputs before risk evaluation.

Broker operations may include place/cancel, deployment-scoped cancel-all, sanitized balances/positions and public market subscription/history. Neither generic HTTP forwarding nor arbitrary signing nor vault reading is a broker operation. UI actions use the same order/risk/journal path as strategies; no UI bypass. Enforce a single engine owner or fencing/lease with crash-safe takeover; two windows must not race the same account.

### Windows strategy threat model

Separate processes isolate crashes and infinite loops; they do **not** sandbox arbitrary Python running as the same Windows user. DPAPI and owner ACLs protect against other ordinary users and offline disclosure, but cannot prevent another process with the same user authority from reading a blob and attempting decryption, inspecting memory, or accessing the network. Administrator compromise and compromised engine dependencies are outside the guarantee.

Use explicit inherited-handle allowlists, a minimal environment, isolated working directories, bounded IPC, CPU/memory/process limits via Windows facilities, and termination on engine exit. Do not inherit pairing/auth tokens, credential file handles, sockets or sensitive environment. Investigate AppContainer/restricted tokens with explicit filesystem, process, IPC and network denial tests. Until actual OS isolation is proven, label workers as **trusted local code only**, record the limitation prominently, and keep untrusted downloaded-strategy execution disabled. ACLs and Job Objects alone must never be advertised as a secure Python sandbox.

## 4. Native secret vault and connection setup

Use Windows per-user DPAPI `CryptProtectData` / `CryptUnprotectData` with **CURRENT USER** scope. Never set `CRYPTPROTECT_LOCAL_MACHINE`. DPAPI is normally tied to the user and machine, but Microsoft documents roaming-profile exceptions; this product separately prohibits roaming, sync, export and restore-to-another-device of credential blobs. See [Microsoft DPAPI documentation](https://learn.microsoft.com/en-us/windows/win32/api/dpapi/nf-dpapi-cryptprotectdata).

SQLite holds an opaque credential reference and non-sensitive local connection state, never plaintext key/secret. Store the encrypted key-plus-secret blob in a versioned vault beneath a private, non-roaming `%LOCALAPPDATA%\ZTerminal` application directory, separate from research exports, workspace archives and cloud sync roots. Exact subdirectory/schema is a future implementation decision. Apply strict owner ACLs to directory, files and atomic-write temporary files; reject permissive inherited ACLs, unsafe redirects/reparse paths, missing ownership, unsupported versions or tamper/decryption failures. Do not fall back to plaintext or machine scope. Recover interrupted writes without exposing partial credentials. Replacement must invalidate the prior credential version; deletion pauses dependent deployments, removes the local reference/blob and requires re-entry to resume. Local deletion does not revoke a key at the exchange; tell the user how to revoke it there.

No API key, secret, signature, listen key, authentication payload or saved credential blob may enter Supabase, Render, cloud storage/sync, web routes, WebViews, browser storage, source code, strategy context, env variables, command-line arguments, logs, telemetry, crash reports, diagnostic bundles, research results or reports. Even encrypted blobs must never sync. Native credential references are device-local and must not become portable reconnect capability.

Central redaction must cover request headers, signed URLs/query/body, private WS messages, errors, exception chains and worker output before logging/export. Prefer allowlisted structured diagnostic fields over raw payload dumps. Capture only non-sensitive normalized state. Disable sensitive transport/debug logging and prevent automatic dumps of engine buffers. Keep decrypted credentials and signatures in short-lived buffers; zeroize where feasible and document unavoidable library copies. Do not promise complete memory erasure from managed copies. Test clipboard/input clearing behavior without asserting control over OS clipboard history.

Settings flow: **Exchanges → MEXC → paste Access Key / Secret Key → select Spot/Futures capabilities → Test connection → save**. Initial test uses read-only authenticated endpoints in a later explicitly authorized implementation validation, never an order. Verify actual granted permissions rather than assuming checkboxes grant them; require no withdrawal permissions, encourage least privilege and IP binding where operationally suitable. Saved credentials have only **Replace** and **Delete**, no reveal/export. Show truthful connected/degraded/expired/permission-denied status and distinguish a tested connection from live activation. This documentation task calls no authenticated endpoint.

## 5. Exchange and strategy contracts

Define or extend `ExchangeAdapter`, `MarketDataAdapter`, `TradingAdapter`, `AccountAdapter`. Normalize orders, fills, positions, balances, market events, symbol info and exchange errors with versioned schemas and preserved venue/product/account provenance. Use existing canonical event types where available instead of redundant wrappers. Adapter capabilities advertise unsupported features explicitly; do not fake modify/TP-SL semantics with unsafe cancel-and-replace.

Trading covers placement, query, cancellation and supported modification; account access covers balances, positions, open orders, historical orders and fills; market access covers subscriptions, history, books, trades, tickers and bars. Public data clients need no private credential capability. Classify errors as validation, permission/auth, rate limit, definite rejection, unavailable, unknown outcome, or protocol mismatch; unknown outcome must not become ordinary retryable failure.

Use deterministic Decimal arithmetic or equivalent exact fixed-point rules. Wire prices, quantities and multipliers are decimal strings. Preserve currency, base/quote units, contract multiplier, tick, step, min/max size, minimum notional, supported order types and trading status from verified symbol metadata. Reject invalid, non-finite, overflow or stale metadata. Do not silently round up exposure; document and test any risk-reducing rounding. Generic numeric BUY/SELL is insufficient for Futures.

The existing Python API is batch signals, not an existing `ctx.broker` event runtime. Build a causally bounded compatibility layer: process completed inputs only, preserve declared next-open backtest semantics, and document live fill timing differences. Full-history arbitrary Python cannot be guaranteed causal just by shifting signals. Extend lifecycle/order/fill/position/timer callbacks only with versioned compatibility tests and a migration guide. Conceptual callbacks `on_start`, `on_bar`, `on_order_update`, `on_fill`, `on_position_update`, `on_timer`, `on_stop` are design examples, not implemented APIs.

The goal is **backtest → paper → live** with minimal strategy changes and explicit execution-model differences. Strategy source/version hash, parameters, engine version, input provenance, account, mode, symbols, policy and lifecycle belong to a durable `StrategyDeployment`. Suggested states: draft, validating, paper-running, live-armed, live-running, paused, degraded, reconciling, stopping, stopped, failed. Arming and starting live require explicit native user action; loading a workspace, reconnecting or restarting the application cannot silently activate trading.

## 6. Durable order protocol and reconciliation

Every order crosses broker authorization, exact symbol validation and central risk approval. Reserve pending exposure and persist a globally unique, restart-safe client ID linked to account, product and deployment. Suggested records: connections (opaque vault reference only), deployment revisions, `OrderIntent`, transmission attempts, exchange orders, fills, reconciliation checkpoints, risk reservations and redacted lifecycle events. Separate local execution storage from portable research archives; version migrations and never rewrite history into fabricated success.

**Durably commit `OrderIntent` before any network send.** SQLite transaction success must mean the selected journal/synchronous configuration survives tested process termination and restart; document filesystem/power-loss limits. Disk full, failed flush/commit or migration failure blocks transmission. Persistent uniqueness constraints include full account/product context and client ID; do not reuse IDs after deletion, restore, sequence reset or restart. Map to Spot `newClientOrderId` and Futures `externalOid` only where current endpoint constraints and query support are verified. IDs are correlation tools, not an assumed exchange exactly-once guarantee.

```text
intent validated -> risk reserved -> journal durably committed -> submission
  -> definite rejection: persist rejection and release reservation
  -> acknowledgement: persist exchange ID and confirmed state
  -> timeout / 5xx / lost acknowledgement / crash: UNKNOWN -> reconciliation
UNKNOWN -> confirmed exchange state or QUARANTINED; no blind resend
```

A persisted intent without acknowledgement may already have reached MEXC. On restart treat uncertain send windows conservatively, including crash between commit and send or between response and exchange-ID persistence. Query by verified client ID and then reconcile open orders, fills, positions and balances with bounded pagination/time coverage. A single not-found response is not proof of non-execution; allow propagation delay, consult all relevant evidence, and quarantine when the outcome cannot be established. Do not issue a fresh client ID to escape ambiguity. Any later retry decision requires a documented, tested proof of non-submission/non-execution or explicit resolution workflow.

Persist exchange order IDs and deployment/account ownership. Deduplicate fills by stable venue/account/product execution identity, and events by documented identifiers/sequence where available. Apply account changes transactionally with their dedup/checkpoint state. Handle partial fills, cancel/fill races, terminal updates arriving before acknowledgements, duplicates and out-of-order messages without double accounting or regressing terminal state. Exchange snapshots are authoritative, but manual/external orders stay separately identified and must not be canceled as strategy-owned.

Startup, private reconnect, network recovery, wake, worker crash, engine crash and ambiguous responses enter reconciliation before trading resumes. Snapshot and buffer/replay streaming events using documented sequence/version rules so snapshots cannot erase newer fills. If the protocol lacks a safe sequence boundary, perform additional REST checks and remain degraded until consistency is demonstrated. Keep risk reservations for unresolved exposure; never release them solely because a request timed out. Quarantine a deployment/account when unknown ownership or irreconcilable state could affect risk.

## 7. Scheduling, WebSocket health and risk firewall

One central scheduler per account/connection owns REST request weights and all relevant account/IP/endpoint limits, aggregating all strategies and UI/reconciliation traffic. Reserve capacity for cancels and authorized risk actions, bound queue depth and intent expiry, and keep enough reconciliation capacity to resolve uncertainty. An expired queued signal is not executed later as if fresh. Recheck health/risk at dispatch with atomic exposure reservation. `429` causes degradation, bounded backoff/jitter and documented retry-after handling, never parallel strategy retry storms. Cancellations are prioritized but never claimed guaranteed during exchange/network failure.

WS states: `DISCONNECTED → CONNECTING → AUTHENTICATING → SYNCING → HEALTHY`; failures lead to `DEGRADED`, `RECONNECTING` or `FAILED`. Heartbeats, stale timers, reconnect backoff, planned rotation, re-subscription, private auth, listen-key renewal, official Spot protobuf decoding, deduplication, out-of-order/lost events and snapshot recovery are required. TLS endpoints and schemas are versioned/allowlisted. A transport connection alone is not healthy data. Gap/stale/corrupt epochs stop strategy decisions until resynchronized; preserve exchange time and actual receive/availability time. REST supplies reconciliation, not a claim that stream ordering can be ignored.

Every order passes central limits: max order notional, max aggregate position notional, symbol allowlist, leverage ceiling, daily loss, orders/minute, simultaneous positions, spread/slippage, stale-data age and a global kill switch. Policies are owned by the engine, not editable by worker payload. Evaluate confirmed plus pending/unknown exposure across deployments sharing an account; reserve atomically so concurrent approvals cannot exceed limits. Daily-loss policy defines timezone/day boundary, fees, realized/unrealized P&L and restart persistence. Missing prices/equity or invalid policy fails closed. Risk-reducing actions need explicitly checked semantics, ownership and scheduler priority; a worker cannot call any order risk-reducing to bypass a gate.

Kill switch blocks new exposure and revokes worker order capabilities; any optional cancel policy is explicit and scoped. It does not promise liquidation or silently close positions. Risk rejects are visible and redacted. Audit/extend `zt-risk` instead of replacing it with a parallel unchecked policy engine.

## 8. Futures-specific model

Architect Futures early but release only after Spot gates. Explicitly model isolated/cross margin, leverage, long/short direction, opening/closing intent, one-way/hedge mode, `reduceOnly`, position identifiers, margin balance, liquidation state, TP/SL capabilities and contract specifications/multipliers. Map normalized intents to verified current MEXC side semantics with a complete mode/direction matrix. Do not infer an open/close action from BUY/SELL alone, or allow a reduction to reverse a position unexpectedly. Reconcile actual exchange account modes before routing; reject incompatible mode/leverage requests rather than silently changing an account used by other strategies. Validate partial-close, partial-fill, cancel races and exchange-native conditional orders. Unsupported features remain visibly disabled.

## 9. Tray, shutdown and failure semantics

Engine lifetime belongs to the native app, not chart subscriptions or an open browser. **Close to tray** continues active deployments while ZTerminal remains running; show a visible tray indicator, active strategy count, connection/risk status and reopen action. **Quit ZTerminal** stops workers and engine. No Windows service, hidden persistence after Quit, or automatic application-start trading in the initial release. Do not change the research helper's close behavior by assuming it already owns this lifecycle.

Quit sequence: stop accepting intents, revoke worker capabilities, persist stopping states, handle in-flight ambiguous sends, perform any configured bounded cancellation of **strategy-owned resting orders only**, persist remaining uncertainty, stop streams/workers and terminate engine. Bound shutdown even when the network fails; report unresolved cancellations. Do not automatically liquidate positions on exit. Warn that positions and exchange-native resting/conditional orders remain active and may fill after exit. Local secret deletion or an app crash does not cancel exchange orders.

| Condition | Required behavior |
| --- | --- |
| Internet lost | Stop new orders; show outage; journal uncertain in-flight sends; reconcile before resume. |
| Market feed stale/gapped | Block new orders/signals; preserve truthful stale/gap status. |
| Private WS lost | Mark degraded; REST reconcile orders/fills/account; resume only after synchronized state. |
| Expired/revoked auth | Pause affected deployments; request credential replacement; no repeated order attempts. |
| Worker crash/hang | Isolate/terminate worker; reconcile its owned activity; require policy-controlled restart after recovery. |
| Engine crash | Startup fencing and journal recovery; reconcile uncertain orders before explicit live restart. |
| Sleep/wake | Detect time discontinuity; clear expired queued signals; reconnect/reconcile; never replay missed signals as new trades. |
| Disk full/corrupt journal | Fail closed for submissions; preserve evidence and surface repair; do not recreate an empty ledger and trade. |
| Rate-limit exhaustion | Bound queues/backoff, reserve recovery/cancel capacity, show degradation. |

## 10. Exchange facts and official verification gate

These are **claims made in the source conversation**, not immutable protocol constants. Public documentation checks on 2026-10-05 confirmed the Spot REST/signing overview and Futures REST/signing overview/key expiry at the links below. The initial lookup also located the official Spot protobuf migration announcement and older official GitHub-hosted references. This is not a complete endpoint conformance audit. Before implementation, re-check current official pages, changelog, account permissions and endpoint availability; record URL, retrieval date, protocol/schema revision and fixture hash for each implemented feature. Do not rely on old wrappers, unsupported WEB/APP authentication or unofficial futures access workarounds.

| Source-era claim | Official reference / required check |
| --- | --- |
| Spot REST `https://api.mexc.com`; `X-MEXC-APIKEY`, `timestamp`, `recvWindow`, HMAC-SHA256 | [Current Spot introduction](https://www.mexc.com/api-docs/spot-v3/introduction). Re-verify byte encoding, signature placement and time-window units against endpoint examples. |
| Futures REST `https://api.mexc.com`; `ApiKey`, `Request-Time`, `Signature`, optional `Recv-Window` | [Current Futures integration guide](https://www.mexc.com/api-docs/futures/integration-guide), [domain change announcement](https://www.mexc.com/en-GB/announcements/article/futures-api-access-domain-update-17827791532974). Re-verify method-specific parameter serialization; Spot and Futures are different signers. |
| Non-IP-bound Futures keys expire after 90 days | Same Futures integration guide confirmed this during the public check; implement truthful expiry handling, not assumptions that renewal is automatic. |
| Spot `newClientOrderId`; Futures `externalOid`; Futures placement 4 requests/2 seconds | [Official Spot API reference](https://mexcdevelop.github.io/apidocs/spot_v3_en/), [official Futures API reference](https://mexcdevelop.github.io/apidocs/contract_v1_en/), [current Futures changelog](https://www.mexc.com/api-docs/futures/update-log). Exact current placement limits, ID constraints and query support remain implementation verification gates; other endpoints have different limits. |
| Spot connection 24h; listen key 60min with renewal; protobuf market streams | Official Spot reference above and [protobuf migration announcement](https://www.mexc.com/en-NG/announcements/article/mexc-v3-websocket-service-replacement-announcement-17827791522393). Re-verify current secure WS URL, schemas, channel names and renewal timing; do not copy old insecure `ws://` examples. |
| Futures WS `wss://contract.mexc.com/edge` | Official Futures reference above; check current WS private authentication, subscriptions and lifecycle separately from REST domain migration. |
| No sandbox; Spot `/api/v3/order/test` validates without matching; Spot 5xx may mean unknown execution | Source-era claims retained pending current official verification of test endpoint semantics, access, limits and ambiguous-error rules. Treat unknown outcomes conservatively regardless of wording changes. `order/test` is not a fills/account simulator and still requires explicit authorized testing. |

No credentials, API connectivity, authenticated requests, test orders or live orders were used to prepare these documents. All exchange facts remain subject to current implementation-time verification.

## 11. Implementation phases and evidence

| Phase | Deliverables | Exit gate |
| --- | --- | --- |
| 0 — audit/contracts | Current seam map, protocol matrix, threat model, causal strategy compatibility design, lifecycle/storage contracts | Reviewed scope; no production claim or order routing. |
| 1 — vault/local foundation | DPAPI vault, strict ACLs, redaction, IPC capability model, versioned execution journal/migrations, native setup/status | Windows security tests pass; no secrets in any sync/export path; live disabled. |
| 2 — paper | Actual permitted MEXC public data; deterministic simulation of fills, fees, latency, slippage, balances, positions and partial fills; same broker/risk/journal surface | Simulation visibly labeled; zero authenticated trading traffic; causal parity and recovery evidence pass. Paper has no live credential dependency. |
| 3 — Spot readiness | Verified Spot signer/filters, private read-only account/WS recovery, reconciliation, scheduler, risk, tray/Quit semantics | All security/crash/failure gates pass; limited Spot can be armed only by explicit user action. Read-only tests need authorized credentials; live smoke testing is separately authorized and bounded. |
| 4 — Spot rollout | Small scoped deployment, monitoring, visible health, kill switch, rollback to disabled-live/paper | No duplicates or unresolved silent exposure; account truth and shutdown behavior demonstrated. |
| 5 — Futures readiness/rollout | Full Futures semantic matrix, independent signer, margin/liquidation/conditional-order recovery, stricter risk | Futures-specific gates pass independently; explicit Futures activation; no automatic promotion from Spot. |

Paper must model finite liquidity/partial fills, fee assets, rejected filters, configurable latency/slippage and deterministic seeds where randomness is deliberate. Document unmodeled market impact, funding or liquidation rather than fabricating results. Futures paper parity requires its own funding/margin/liquidation semantics or an explicit disabled-live gate for unsupported behavior. Rollback stops new intents and revokes live capability; it does not assume local rollback can undo exchange positions/orders.

## 12. Testing and acceptance requirements

Use deterministic local mocks, synthetic credentials and saved official-shaped fixtures first. Tests must assert invariants and crash windows, not merely mirror functions. Record build/commit, Windows user/OS conditions, protocol fixtures, test commands and results. Do not claim a passing documentation check proves any future runtime gate.

| Test family | Required cases and passing evidence |
| --- | --- |
| Signing | Known Spot and Futures vectors; method-specific order/encoding/body bytes; empty/null/path parameters; timestamp drift and receive-window units; no secret/signature in failure output. |
| Decimal/filters | Tick/step, notional boundaries, multiplier/unit conversions, max/min size, unsupported types, symbol suspension, stale metadata, overflow, no exposure-increasing rounding. |
| Journal durability | Kill process before commit, after commit/before send, after send/before response, after ack/before exchange-ID commit, during fill commit; disk full/flush failure; restart/migration/restore; persistent ID uniqueness. No send without durable intent. |
| Reconciliation | Accepted order with timeout/5xx; delayed not-found; partial fills; cancel/fill race; pagination/gaps; late/out-of-order/duplicate events; startup, wake and reconnect; manual orders; quarantine unknown ownership. At most one economic submission per resolved intent and no duplicate fill/accounting. |
| Scheduler | Multiple strategies/UI share limits; endpoint weights/account/IP constraints; cancel/recovery reserve; queue expiry; 429/backoff; no retry storm or worker bypass. |
| WS | Heartbeat timeout, planned rotation, listen-key renewal/expiry/auth failure, binary protobuf fixtures/schema mismatch, duplicate/out-of-order/lost frames, buffer overflow, snapshot race, recovery health gate. |
| Risk | Every limit individually and in combination; parallel intents reserve aggregate exposure; unknown exposure; stale/missing equity/prices; persistent daily loss; kill switch; spoofed policy; reduction cannot increase exposure. |
| Worker/IPC | Crash/hang/CPU/memory/process exhaustion; malformed/oversized IPC; unauthorized peer, wrong account/product/mode/deployment, revoked token, inherited handles/env; no direct signer. Demonstrate same-user sandbox limitation or prove chosen OS restrictions. |
| Vault | Same-user DPAPI round trip; different-user failure; forbidden machine scope; roaming/sync exclusion; owner ACL verification; tampered/missing/version-invalid blob; atomic-write interruption; replace/delete and migration; plaintext absent from SQLite/temp/export. |
| Redaction/sync | Sentinel keys/secrets/signatures/listen keys in exceptions, URLs, transport logs, worker stdout/stderr, diagnostics, telemetry/crash/report paths; blobs and credential refs excluded from cloud/workspace/import/export; fail closed for unexpected fields. |
| Native lifecycle | Minimize/close-to-tray sustains bounded execution; visible active status; Quit terminates engine/workers; no orphan restart; in-flight ambiguity; configured owned-only cancel and cancellation failure; no automatic liquidation. |
| Sleep/network | Internet loss, stale feed, private disconnect, revoked auth, engine/worker crash, sleep across signals and clock jump; no new orders until synchronized; no missed-signal replay. |
| Mode isolation | Backtest/paper/live contract parity; paper never invokes private trading or uses live vault credentials; explicit activation; cannot change mode by import/sync/IPC spoofing. |
| Futures | Isolated/cross, leverage, open/close, long/short, one-way/hedge, reduceOnly, position IDs, partial close, margin/liquidation, TP/SL/native conditional orders, funding and multipliers; unsupported mappings fail closed. |

Acceptance means a user can store/test/replace/delete native credentials without revealing them; run the same supported strategy through honest backtest and paper modes; explicitly activate a separately gated Spot/Futures deployment; see health/risk/ownership and active tray state; and quit knowing what remains at the exchange. Secrets never leave the native security boundary, ambiguous sends never blindly repeat, fills/account state never double count, and failures block unsafe new activity. Windows DPAPI/ACL and lifecycle evidence, deterministic protocol/semantic tests, cloud-exclusion evidence, and reviewed unresolved limitations are mandatory before claiming production readiness.

## 13. Future implementation handoff

Use [the implementation-agent prompt](../implementation/mexc-live-execution-agent-prompt.md) only when implementation is explicitly requested. It directs the coding agent to refresh repository and official protocol evidence, deliver phases separately, preserve current research contracts and list exact changed files and validation. This documentation task does not execute that prompt.
