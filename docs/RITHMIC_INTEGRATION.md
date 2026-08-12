# RITHMIC_INTEGRATION

> **Status: NOT operational in this environment.** This document describes
> **only verified** information present in the codebase. It does not invent
> endpoints, protobuf messages, or authentication flows.

## 1. Verified status

The Rithmic R | Protocol API integration is **interface-only**. It is NOT
operational in this repository for four documented reasons:

1. **No Rithmic protobuf dev-kit is bundled.** The Rithmic adapter requires
   the official R | Protocol API protobuf definitions and tooling, which are
   not checked into this repository.
2. **No credentials are present.** No Rithmic user, system name, or token
   exists in environment configuration. Credentials must be supplied by the
   operator under a valid Rithmic agreement.
3. **No conformance testing has been performed.** The adapter has never been
   exercised against the Rithmic Test (Exchange Simulator) or Production
   environments. Sequence validation, heartbeat cadence, and reconnect
   behavior have not been verified against a real Rithmic endpoint.
4. **Production access requires authorization.** Rithmic Production access is
   granted by Rithmic per account and is not assumed by this codebase. Using
   Production without explicit authorization would violate the provider's
   terms.

Until all four conditions are satisfied, the terminal runs against the
deterministic SIMULATED mock provider (see `ARCHITECTURE.md`).

## 2. Verified code surface

### `IRithmicProvider` interface (`src/lib/market/provider.ts`)

```ts
export interface IRithmicProvider extends MarketDataProvider {
  readonly id: "rithmic-test" | "rithmic-prod";
  login(): Promise<void>;
  heartbeat(): Promise<void>;
  restoreSubscriptions(): Promise<void>;
  validateSequence(symbol: string, seq: number): boolean;
  logout(): Promise<void>;
}
```

These methods mirror the **lifecycle** a real Rithmic adapter must implement:
authentication, heartbeat, subscription restoration after reconnect,
per-symbol sequence validation (reject gaps), and graceful teardown. The
**wire protocol** behind each method (Rithmic R | Protocol API protobuf
messages, request/response pairing, template IDs) is **not** implemented here
and requires the official Rithmic dev-kit and documentation.

### Provider stubs

| Class (interface-only)         | `id`             | `environment` |
|--------------------------------|------------------|---------------|
| `RithmicTestProvider`          | `rithmic-test`   | simulation (Rithmic Test / Exchange Simulator) |
| `RithmicProductionProvider`    | `rithmic-prod`   | live (requires authorization) |

These are declared in `provider.ts` as interface contracts only. No
implementation, no protobuf wiring, no socket transport, no authentication
flow is present.

### `MockRithmicProvider`

The `MockLiveMarket` class in `src/lib/market/mock-provider.ts`, surfaced
through the socket.io mini-service (`mini-services/market-data/index.ts`),
provides clearly-SIMULATED data that satisfies the `MarketDataProvider` and
`IRithmicProvider` contract shape for development:

- Emits normalized `TradeEvent`, `QuoteEvent`, `DepthEvent` on a ~6 tick/sec
  cadence.
- Every event carries `provider: "mock"`, `environment: "simulation"`.
- Monotonic per-symbol `sequence` numbers (the contract for
  `validateSequence`).
- Connection lifecycle is handled by socket.io ping/pong + client-side
  exponential backoff + subscription restoration on reconnect.

This is **not** a Rithmic emulator. It is a deterministic synthetic feed that
lets the terminal UI, analytics, and backtester be developed end-to-end
without credentials.

## 3. Rithmic environments (reference)

Rithmic exposes two environments for the R | Protocol API. These are
referenced here for orientation only — the operator must obtain the official
Rithmic documentation and dev-kit to implement against them.

- **Rithmic Test (Exchange Simulator).** A paper-trading environment that
  simulates exchange behavior. Appropriate for adapter development,
  conformance testing, and strategy validation. Access is granted under a
  Rithmic agreement.
- **Rithmic Production.** Real-market-data and order-routing environment.
  Requires explicit authorization and entitlement. Out of scope for this
  repository until authorized.

## 4. Credential handling (enforced)

Rithmic credentials are server-side secrets. The following is enforced by
code review and must remain true:

- Credentials are read from **server-side environment variables** only —
  never hardcoded, never committed, never logged.
- Credentials **never reach the browser** — no exposure via API responses,
  no `localStorage`, no URL parameters, no client bundles.
- The Rithmic adapter runs **server-side only** (Next.js route handlers or a
  dedicated server process). It is not imported by any client component.
- Logs must redact credentials and tokens. Heartbeat and reconnect logs must
  not include authentication payloads.

See `SECURITY.md` for the full credential policy.

## 5. What would be required to enable the adapter

The following are **out of scope** for this repository but documented here so
the gap is explicit:

1. Obtain the official Rithmic R | Protocol API protobuf dev-kit and
   documentation directly from Rithmic under a valid agreement.
2. Implement the adapter against the verified `IRithmicProvider` contract —
   real protobuf message encoding/decoding, template IDs, request/response
   pairing, heartbeat cadence, and reconnect/restore behavior.
3. Run conformance testing against Rithmic Test (Exchange Simulator) before
   any Production consideration.
4. Add server-side credential configuration (environment secrets) and a
   connection-health surface in the UI.
5. Only then, with explicit authorization, consider Production.

No part of the current codebase is authorized for live trading. Until the
above is complete, all market data shown in the terminal is `SIMULATED` and
must be labeled as such.
