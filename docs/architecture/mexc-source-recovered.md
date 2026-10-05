# MEXC playbook — recovered source excerpt

Source: ChatGPT conversation **MEXC API Implementation Playbook**, conversation ID `6ac3954e-8404-83ed-89d0-b2ccc4f72f89`, assistant message ID `8c29734f-c58a-47d5-8680-39b2dcb5a967`. Retrieved on 2026-10-05 with `read_thread`, `turnLimit=10`, `maxOutputCharsPerItem=20000`.

**Incomplete source:** The reader returned `truncated: true`; the text ends during implementation-prompt section 8. The reader rejects limits above 20,000. The originating task also attempted supported browser recovery, but the browser was signed out. No later original sections were recovered. Original citation markers are preserved as source text; they are not resolved source links. The original writing-block opener has no recovered closing delimiter.

The excerpt below preserves the returned assistant text verbatim, including source-era protocol claims. Those claims require current official-document verification. This artifact is historical source, not authorization to implement or trade. See [the proposed architecture](mexc-live-execution.md) and [the reconstructed complete implementation prompt](../implementation/mexc-live-execution-agent-prompt.md).

````text
Yes. The right architecture is **local execution, local secrets, cloud metadata only**. I would not let MEXC credentials touch ZTerminal Web, Supabase, sync, telemetry, logs, strategy source, environment variables, or the Python process.

A few current MEXC facts materially affect the design. MEXC currently has **no sandbox/test environment** for its API, although Spot has `/api/v3/order/test`, which validates an order without sending it to the matching engine. That means ZTerminal needs its own first-class paper/shadow execution layer before live trading. :chatgpt-content-reference{index="0"} Futures REST now uses `https://api.mexc.com`; private futures calls use `ApiKey`, `Request-Time`, `Signature`, and optional `Recv-Window`, and MEXC says futures keys without an IP binding expire after 90 days. :chatgpt-content-reference{index="1"}

For Futures specifically, order placement is currently limited to 4 requests per 2 seconds and supports `externalOid`, which is exactly what ZTerminal should use for order idempotency/recovery. MEXC also provides private WebSocket events for orders, fills and positions. :chatgpt-content-reference{index="2"} For Spot, MEXC explicitly warns that an HTTP 5xx does **not** prove an order failed—the execution status can be unknown. That means a timeout/5xx must trigger reconciliation by client order ID, **not an automatic resubmit**. :chatgpt-content-reference{index="3"}

## The architecture I would use

```text
┌──────────────────────────────────────────────────────────┐
│                  ZTerminal Windows UI                    │
│ Exchange connections • Strategies • Risk • Logs         │
└───────────────────────┬──────────────────────────────────┘
                        │ local IPC
                        ▼
┌──────────────────────────────────────────────────────────┐
│             ZTerminal Execution Engine                   │
│                                                          │
│  ┌──────────────┐    ┌─────────────┐   ┌─────────────┐  │
│  │ Risk Engine  │───▶│ Order Router│──▶│ MEXC Adapter│──┼── MEXC
│  └──────────────┘    └─────────────┘   └─────────────┘  │
│          ▲                    │                 │         │
│          │                    ▼                 ▼         │
│  ┌──────────────┐      ┌───────────┐    ┌───────────┐   │
│  │ Strategy IPC │      │ Order DB  │    │ WS Engine │   │
│  └──────┬───────┘      └───────────┘    └───────────┘   │
└─────────┼────────────────────────────────────────────────┘
          │ capability-limited IPC
          ▼
┌──────────────────────────────────────────────────────────┐
│              Python Strategy Workers                     │
│                                                          │
│  NO MEXC SECRET                                          │
│  NO signing                                              │
│  NO direct exchange client                               │
│                                                          │
│  ctx.order(...) → Execution Engine                       │
└──────────────────────────────────────────────────────────┘
```

The **most important boundary** is between the Python strategy worker and the execution engine. A strategy should ask ZTerminal to trade; it should not itself hold or sign with the MEXC credential.

For Windows secrets, I would use **per-user Windows DPAPI** via `CryptProtectData`/`CryptUnprotectData`, without `CRYPTPROTECT_LOCAL_MACHINE`. Microsoft says normal DPAPI protection is normally decryptable only by the same Windows user on the same machine; machine scope would weaken that by allowing other users on that machine to decrypt it. :chatgpt-content-reference{index="4"} I actually prefer that to Windows Credential Locker here because Credential Locker can roam credentials through the Microsoft account, while your design calls for genuinely device-local exchange credentials. :chatgpt-content-reference{index="5"}

### The implementation playbook

I would build the feature in this order rather than trying to turn on live automated Futures trading immediately:

1. **Audit ZTerminal first.** Locate the Windows app shell, existing Python execution system, strategy contracts, SQLite persistence, workspace/cloud sync, WebSocket managers and any current exchange abstraction. Extend what exists rather than creating a second trading architecture.

2. **Create a real exchange abstraction.** Define `ExchangeAdapter`, `MarketDataAdapter`, `TradingAdapter`, `AccountAdapter` and normalized `Order`, `Fill`, `Position`, `Balance`, `SymbolInfo` contracts. MEXC becomes the first live-execution adapter rather than hard-coded MEXC logic leaking throughout the app.

3. **Implement the secret vault.** Save only an opaque credential ID in SQLite. Save API key + secret in a DPAPI-protected local blob under ZTerminal's private application directory with owner-only ACLs. Never cloud-sync it. Never put the secret into process arguments, environment variables, logs, crash reports or strategy context.

4. **Build connection setup.** Add `Settings → Exchanges → MEXC`. User pastes Access Key and Secret Key, selects Spot/Futures permissions and presses **Test connection**. Validate credentials using read-only endpoints first. After storage, never show the secret again—only Replace/Delete.

5. **Implement paper mode before live mode.** Because MEXC has no real sandbox, use actual MEXC market data while ZTerminal simulates fills, fees, latency and positions internally. Live activation should be a separate explicit action.

6. **Build the persistent execution engine.** It runs while ZTerminal is running, including while the UI is minimized to the system tray. Do **not** turn it into a Windows service yet. `Quit ZTerminal` means the execution engine terminates; minimizing or closing the main window to tray does not.

7. **Build strategy workers.** Each running strategy gets a deployment with strategy version/hash, account connection, symbols, mode, risk policy and lifecycle state. Prefer separate workers so one infinite loop or crash cannot kill every strategy.

8. **Never expose credentials to strategy code.** Strategy code receives something like `ctx.broker.place_order(...)`. The broker lives outside the strategy process. If you want ZTerminal eventually to run untrusted downloaded Python strategies, normal process separation is not enough—you will need genuine Windows AppContainer/restricted-token isolation because arbitrary Python under the same Windows user can otherwise access far more of the machine than you want.

9. **Journal before sending an order.** Persist an `OrderIntent` transaction first. Generate a globally unique ZTerminal client ID. Use `newClientOrderId` on Spot and `externalOid` on Futures. Then submit. Persist the resulting exchange order ID afterward. Spot currently supports `newClientOrderId`; Futures supports `externalOid`. :chatgpt-content-reference{index="6"}

10. **Make reconciliation authoritative.** On startup, reconnect, resume-from-sleep, worker crash or ambiguous REST response, fetch current MEXC orders/positions/account state and reconcile it against ZTerminal's local journal. Never infer exchange state purely from the last local event.

11. **Centralize rate limiting.** Strategies must never independently hammer MEXC. One account-level scheduler owns REST limits, prioritizing cancels/risk actions above new orders. A `429` should degrade the connection rather than unleash retries.

12. **Use WebSockets for state, REST for reconciliation.** MEXC Spot WebSocket connections currently have a 24-hour maximum connection lifetime and its user-data `listenKey` lasts 60 minutes unless renewed; current Spot market streams use protobuf. Handle proactive rotation instead of waiting for failure. :chatgpt-content-reference{index="7"} Futures currently exposes its native WS at `wss://contract.mexc.com/edge`, even though Futures REST moved to `api.mexc.com`. :chatgpt-content-reference{index="8"}

13. **Put a risk firewall between strategies and MEXC.** Every order passes through it. Support max order notional, max position notional, symbol allowlist, maximum leverage, daily loss, orders/minute, max simultaneous positions, max spread/slippage, stale-data protection and a global kill switch.

14. **Define failure semantics explicitly.** Internet lost → stop new orders. Market feed stale → stop new orders. MEXC private WS lost → degraded state + reconciliation. Auth expired → pause strategy. Engine worker crash → reconcile before restarting. Windows sleep → do not replay missed signals; resynchronize and continue from present market state.

15. **Do not automatically close positions when ZTerminal exits.** That behavior is too dangerous as a default. Stop strategy execution and clearly warn that positions/exchange-native orders remain active. Optionally support `Cancel strategy-owned resting orders when strategy stops` as a per-strategy setting.

16. **Ship Spot before Futures.** Architect both from day one, but production-live Spot should come first. Futures adds leverage, one-way/hedge position modes, `reduceOnly`, liquidation state, margin mode and more dangerous recovery cases. Turning both on simultaneously makes testing much harder.

### Minimum live-strategy contract

I would converge the existing strategy system toward something conceptually like:

```python
def on_start(ctx):
    pass

def on_bar(ctx, bar):
    if condition:
        ctx.orders.market_buy(
            symbol="BTCUSDT",
            quantity=0.001
        )

def on_order_update(ctx, order):
    pass

def on_fill(ctx, fill):
    pass

def on_position_update(ctx, position):
    pass

def on_timer(ctx, timestamp):
    pass

def on_stop(ctx):
    pass
```

But **don't create a new incompatible ZTerminal language just because this API looks clean**. The implementation agent should adapt your existing backtesting/strategy contract so the same strategy can move between backtest → paper → live with the minimum possible code differences.

And this is the prompt I'd give Codex / GPT-6.1 Sol / Antigravity to actually implement it:

:::writing{variant="document" id="48317" title="ZTerminal MEXC Native Live Execution — Implementation Prompt"}
# ZTerminal — MEXC Native Live Strategy Execution

You are acting as the senior engineer responsible for implementing production-grade MEXC API trading inside the ZTerminal Windows application.

This is not a prototype and not merely an API-demo task.

The goal is to allow a ZTerminal user to:

1. Add their own MEXC Access Key and Secret Key to the ZTerminal Windows application.
2. Store those credentials locally and securely using Windows-native security.
3. Run ZTerminal coded strategies in Paper or Live mode.
4. Allow active Live strategies to execute trades through MEXC while ZTerminal remains running.
5. Continue strategy execution when the main ZTerminal window is minimized/hidden to the system tray.
6. Stop execution when ZTerminal actually exits.
7. Recover safely from network interruptions, API errors, WebSocket disconnects, strategy crashes and ambiguous order responses.
8. Ensure strategy code NEVER receives the raw MEXC secret key.
9. Ensure MEXC credentials NEVER enter ZTerminal cloud sync, Supabase, telemetry, logs, browser storage, strategy source, environment variables, command-line arguments or crash diagnostics.

The implementation must fit ZTerminal's existing architecture instead of creating a parallel application inside the repository.

---

# 1. FIRST: AUDIT THE EXISTING REPOSITORY

Before changing code, inspect and document the current implementation of:

- Windows/native application shell
- strategy editor
- Python runtime
- backtesting runtime
- live/streaming market-data architecture
- current Binance/Gate/etc. adapters if present
- WebSocket managers
- IPC architecture
- SQLite/local persistence
- Supabase/cloud persistence
- workspace storage
- authentication
- application lifecycle
- system tray support
- logging
- settings/preferences
- strategy contracts/interfaces
- existing order/position models
- testing infrastructure

Do not assume framework choices before examining the repository.

Do not rewrite working systems unnecessarily.

Identify the cleanest integration seams and reuse them.

Before major changes, produce a concise architecture note describing:

CURRENT:
[existing relevant architecture]

TARGET:
[new MEXC/live execution architecture]

MIGRATION:
[what will be extended/replaced]

Then implement.

---

# 2. NON-NEGOTIABLE SECURITY MODEL

The MEXC Secret Key is one of the highest-sensitivity values ZTerminal can possess.

Treat it accordingly.

Never store MEXC API credentials in:

- plaintext SQLite
- JSON config
- localStorage
- IndexedDB
- Supabase
- cloud workspace state
- source code
- logs
- telemetry
- Sentry/error reporting
- clipboard history beyond normal user paste behavior
- environment variables
- process arguments
- Python strategy globals
- Python environment
- generated reports

Use Windows per-user DPAPI protection.

Prefer:

CryptProtectData / CryptUnprotectData

using CURRENT USER scope.

DO NOT use CRYPTPROTECT_LOCAL_MACHINE.

Create an abstraction similar to:

SecureCredentialStore

with methods conceptually similar to:

saveCredential()
loadCredential()
deleteCredential()
replaceCredential()
credentialExists()

The persistence database must store only an opaque credential reference/ID.

Example:

exchange_connections
- id
- exchange = "mexc"
- label
- credential_ref
- account_capabilities
- created_at
- updated_at
- last_verified_at

The raw credential must exist only in DPAPI-protected device-local storage.

Use strict filesystem ACLs on any encrypted blobs.

Never sync the encrypted blob to another device.

Never log:

- Access Key
- Secret Key
- Signature
- authenticated request headers
- complete signed URLs
- private WebSocket authentication payloads

Redact them centrally.

Avoid keeping secret strings alive in memory longer than necessary.

Where the implementation language allows it, clear sensitive buffers after use.

The UI must never provide a "Reveal saved secret" feature.

After a credential is stored, only:

Replace credential
Delete credential

should be possible.

---

# 3. IMPORTANT STRATEGY SECURITY BOUNDARY

DO NOT inject MEXC credentials into the Python strategy runtime.

DO NOT implement:

strategy -> mexc SDK directly

Implement:

strategy
    ↓
ZTerminal Strategy/Broker API
    ↓ IPC
Execution Engine
    ↓
Risk Engine
    ↓
Order Router
    ↓
MEXC Adapter

The execution engine alone owns credential access and exchange signing.

Strategies receive capabilities, not secrets.

Example conceptual strategy API:

ctx.orders.place(...)
ctx.orders.cancel(...)
ctx.orders.cancel_all(...)
ctx.account.balance(...)
ctx.positions.get(...)
ctx.market.subscribe(...)
ctx.market.history(...)

The strategy must never need:

api_key
secret_key
signature
HTTP authentication logic

If existing ZTerminal strategy contracts already provide equivalent interfaces, EXTEND THEM instead of inventing an incompatible API.

A major product objective is:

BACKTEST
    ↓
PAPER
    ↓
LIVE

with minimal or ideally zero strategy-code changes.

---

# 4. DO NOT CLAIM ARBITRARY PYTHON IS SANDBOXED UNLESS IT ACTUALLY IS

Python process separation alone is NOT a security sandbox.

If current strategy code executes with the full user's Windows permissions, document that limitation accurately.

At minimum:

- never expose secrets to the worker
- use dedicated strategy worker processes
- restrict inherited handles
- do not inherit sensitive environment variables
- use an isolated working directory
- enforce CPU/memory/process limits using appropriate Windows facilities
- prevent a worker crash from killing the main engine

Investigate genuine Windows isolation such as AppContainer / restricted tokens for future or current implementation.

If real OS-level isolation cannot safely be completed in this change, do not pretend it exists.

Keep the architecture compatible with adding it.

---

# 5. EXCHANGE ABSTRACTION

MEXC should not be hard-coded throughout the application.

Introduce or extend an exchange abstraction.

Conceptually:

ExchangeAdapter

MarketDataAdapter
- connect()
- disconnect()
- subscribeTrades()
- subscribeTicker()
- subscribeOrderBook()
- subscribeBars()

AccountAdapter
- getBalances()
- getPositions()
- getOpenOrders()
- getOrder()
- getFills()

TradingAdapter
- placeOrder()
- cancelOrder()
- cancelAll()
- modifyOrder() where supported

Normalize exchange-specific structures into ZTerminal models:

NormalizedOrder
NormalizedFill
NormalizedPosition
NormalizedBalance
NormalizedMarketEvent
NormalizedSymbolInfo
NormalizedExchangeError

Preserve raw exchange payloads only when genuinely needed for debugging, and ensure they contain no credentials.

---

# 6. IMPLEMENT MEXC SPOT

Use the CURRENT official MEXC API documentation.

Do not rely on memory or old unofficial wrappers.

Current Spot API architecture includes:

REST base:
https://api.mexc.com

Signed requests use:
X-MEXC-APIKEY
timestamp
recvWindow
HMAC-SHA256 signature

Implement the current signing algorithm exactly.

Add deterministic signing unit tests using known request vectors.

Support the trading primitives required by ZTerminal:

- exchange information
- symbol filters
- balances
- current orders
- historical/query order
- place order
- cancel order
- fills/trades
- user-data events
- required market data

Use MEXC's newClientOrderId whenever supported.

ZTerminal must generate its own client order ID.

Example conceptual structure:

zt_<deployment-short-id>_<sequence>_<nonce/hash>

It must be:

- unique
- persistable
- queryable
- linked to StrategyDeployment
- linked to OrderIntent

Do not reuse client IDs.

Respect symbol:

- minimum quantity
- quantity step
- minimum notional
- price tick
- supported order types
- trading status

Never silently round in a way that increases risk.

Use deterministic Decimal arithmetic for monetary quantities.

Avoid floating-point money calculations.

---

# 7. IMPLEMENT MEXC FUTURES

Architect Futures alongside Spot, but do not assume Spot semantics are sufficient.

Use the current official MEXC Futures documentation.

Current REST base is:

https://api.mexc.com

Private requests currently use headers including:

ApiKey
Request-Time
Signature
Recv-Window where applicable

Implement the documented Futures signing algorithm exactly.

Futures requires explicit modeling of:

- isolated vs cross
- leverage
- long/short
- opening vs closing
- one-way vs hedge mode
- reduceOnly
- position IDs where required
- liquidation state
- margin state
- TP/SL where supported
- symbol contract specifications

Use externalOid for ZTerminal-generated client order IDs whenever supported.

Do not infer position direction from a generic BUY/SELL abstraction incorrectly.

Build an explicit normalized intent layer that maps safely to MEXC's current futures side semantics.

Respect MEXC's documented order-placement rate limits.

Rate limits must be enforced centrally per connection/account.

Individual strategies may not independently bypass the limiter.

---

# 8. WEBSOCKET ARCHITECTURE

Use WebSockets as the primary streaming mechanism.

REST is the reconciliation source.

Implement resilient connection state machines.

States should include conceptually:

DISCONNECTED
CONNECTING
AUTHENTICATING
SYNCING
HEALTHY
DEGRADED
RECONNECTING
FAILED

Handle:

- ping/pong
- planned connection rotation
- unexpected disconnect
- stale streams
- authentication failure
- re-subscription
- duplicate messages
- out-of-order events
- lost events
- sequence handling where required

For Spot, handle the current protobuf-based market streams properly using the official schema.

Do not parse binary/protobuf payloads using brittle string hacks.

User-data/listen-key lifecycle must be renewed before expiry.

For Futures, implement current MEXC private authentication and subscr
````

**End of recovered excerpt.** No missing original text is implied by this closing marker. The separate implementation prompt is a supplementary reconstruction, not the complete verbatim original.
