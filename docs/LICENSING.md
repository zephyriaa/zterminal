# LICENSING

Market-data licensing is a **first-class concern**. Z TERMINAL is built to
operate against authorized market-data APIs only. The current repository
ships with **synthetic SIMULATED data** that carries no licensing
obligation, but any move to real market data triggers the obligations
below.

## 1. Current state — no licensing obligation

The mock provider (`src/lib/market/mock-provider.ts`) and the socket.io
mini-service generate **synthetic** data via deterministic RNG seeded from
symbol and timeframe strings. The contract universe (`contracts.ts`) lists
real instrument symbols (NQ, MNQ, ES, MES, QQQ, SPY) and realistic
reference price/volatility levels for the mock generator, but **no real
exchange data is fetched, stored, or redistributed**.

Because the data is synthetic:

- No exchange agreement is required to run the terminal in this
  configuration.
- No per-user entitlement is needed.
- The `SimulatedTag` badge and `DataStatus: "SIMULATED"` field surface this
  to the user on every panel and API response.

## 2. Real market data — licensing gates

Before any commercial or production use that displays, stores, or
redistributes real Rithmic or CME data, the operator MUST verify and
document the following:

### 2.1 Display rights
The right to display real-time quotes, depth, and trades in a terminal UI.
Goverened by the exchange/vendor agreement (e.g. CME Group market-data
agreement for futures, Rithmic entitlement for the R | Protocol API feed).

### 2.2 Redistribution rights
The right to redistribute quotes, depth, or derived data to other users.
Most exchange agreements distinguish **internal use** from **external
redistribution** — the latter typically requires a separate entitlement
and per-user fees.

### 2.3 Historical storage rights
The right to persist historical bars, ticks, or MBO events for backtesting.
Exchanges often cap retention, require record-keeping of entitlements, or
prohibit re-distribution of stored history to non-entitled users.

### 2.4 Derived-data rights
The right to expose **derived** data — VWAP, footprints, CVD, indicators,
backtest results computed from the underlying feed. Some agreements treat
derived data the same as raw data for redistribution purposes.

### 2.5 Per-user entitlements
Each end-user viewing real data must hold the appropriate entitlement at
the exchange/vendor. The terminal must enforce entitlement checks
server-side before streaming real data to a session.

## 3. Prohibited data sources

The following are explicitly **prohibited** under
`PROJECT_RULES.md` and will not be added to this codebase:

- **Scraping** TradingView, Rithmic UI, Bookmap, ATAS, Sierra Chart,
  NinjaTrader, or any broker's terminal for market data.
- **Screen-scraping** or OCR of any vendor's display.
- **Reverse-engineering** proprietary wire protocols without an executed
  agreement.
- **Embedding** third-party terminals in iframes as a data shortcut.
- **Re-using** credentials or sessions from another vendor's account.

Use authorized APIs only. If a vendor API is not available under an
acceptable agreement, the terminal stays on the SIMULATED mock provider.

## 4. Rithmic specifically

The Rithmic R | Protocol API is the intended production path for futures
data. Access is gated by:

1. A valid Rithmic agreement (Test and/or Production).
2. Per-user system name and credentials issued under that agreement.
3. CME Group market-data entitlements for the specific instruments
   (NQ/MNQ/ES/MES are CME futures).
4. Conformance testing against the Rithmic Test (Exchange Simulator)
   before any Production access — see `RITHMIC_INTEGRATION.md`.

None of the above is present in this repository. The `IRithmicProvider`
interface is documented; no wire protocol, no protobuf dev-kit, no
credentials are bundled.

## 5. Equity data

QQQ (NASDAQ) and SPY (NYSE) equity data, when sourced from a real feed,
requires the relevant equity market-data agreement (e.g. a SIP
consolidated feed or a direct exchange feed). The mock provider currently
synthesizes these without any agreement.

## 6. Operator responsibility

Licensing compliance is the **operator's** responsibility, not the
codebase's. The codebase enforces:

- Clear `SIMULATED` labeling when running on the mock provider.
- A provider abstraction that lets a licensed operator plug in a real
  Rithmic adapter without changing analytics or UI code.
- Server-side-only credential handling so entitlement credentials are not
  exposed.

The codebase does **not** enforce entitlement checks, redistribution
controls, or retention caps on real data — those must be implemented by
the operator under their exchange agreement before any real data is
connected.

## 7. Disclaimer

This document is engineering guidance, not legal advice. The operator
must consult the relevant exchange and vendor agreements (CME Group,
Rithmic, NASDAQ, NYSE) and obtain qualified legal counsel before any
commercial deployment involving real market data.
