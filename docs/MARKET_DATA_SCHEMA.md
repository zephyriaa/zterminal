# MARKET_DATA_SCHEMA

This document specifies every normalized type in
`src/lib/market/types.ts`. These types are the **internal source of truth**.
Provider adapters (Mock / Rithmic Test / Rithmic Production / future
Databento) MUST normalize their native messages into these types. Analytics,
the backtester, and the UI must never depend on provider-specific code.

## 1. Common conventions

Every normalized event carries the following fields:

| Field         | Type        | Meaning |
|---------------|-------------|---------|
| `type`        | string literal | Discriminator (`"trade"`, `"quote"`, `"depth"`, `"mbo"`, `"bar"`) |
| `provider`    | `ProviderId` | `"mock" \| "rithmic-test" \| "rithmic-prod" \| "databento"` |
| `environment` | `Environment` | `"simulation" \| "paper" \| "live"` |
| `symbol`      | string      | Normalized uppercase root or front-month symbol (e.g. `"NQ"`) |
| `exchange`     | `Exchange`  | `"CME" \| "CBOT" \| "COMEX" \| "NYMEX" \| "NASDAQ" \| "NYSE" \| "ICE"` |
| `timestamp`   | number (epoch ms, UTC) | Event time, always UTC internally |
| `sequence`    | number      | Monotonic per-symbol sequence number; adapters reject gaps |

### Timezone discipline

- **Internal:** all timestamps are UTC epoch milliseconds. No event ever
  carries a local-time string.
- **Sessions:** market sessions are expressed in America/New_York (ET) —
  CME ETH (18:00 prior day → 17:00 ET, Sun–Fri) and equity RTH
  (09:30–16:00 ET). Session classification lives in
  `src/lib/market/session.ts` and is centralized there. See
  `SESSION_NOTE` in `contracts.ts`.
- **Display:** the topbar formats both ET and UTC clocks via
  `formatClockET` / `formatClockUTC`.

### Price alignment

All prices are tick-aligned to the contract's `tickSize` via
`roundTick(price, tick)` in the mock provider. Adapters must apply the same
discipline so analytics never see sub-tick prices.

## 2. Trade (time & sales)

```ts
interface TradeEvent {
  type: "trade";
  provider: ProviderId;
  environment: Environment;
  symbol: string;
  exchange: Exchange;
  timestamp: number;      // UTC ms
  sequence: number;
  price: number;          // tick-aligned
  quantity: number;
  side: Side;             // "buy" | "sell" — aggressor side
  conditions?: string[];  // exchange-specific condition codes
}
```

`side` is the **aggressor** side (the taker). `Aggressor = "buy" | "sell" |
"unknown"` is the broader type; trades always carry a known aggressor in the
mock provider.

## 3. Quote (top of book)

```ts
interface QuoteEvent {
  type: "quote";
  provider; environment; symbol; exchange; timestamp; sequence;
  bid: number;
  ask: number;
  bidSize: number;
  askSize: number;
}
```

## 4. Depth of book

```ts
interface DepthLevel {
  price: number;
  size: number;
  side: Side;              // "buy" | "sell"
  orders?: number;        // order count at this level (when available)
}

interface DepthEvent {
  type: "depth";
  provider; environment; symbol; exchange; timestamp; sequence;
  levels: DepthLevel[];   // snapshot or delta of the ladder
}
```

## 5. Market-by-order (MBO)

Only emitted when the provider genuinely supplies MBO. The
`ContractMetadata.supportsMBO` flag is the contract-level declaration of this
capability.

```ts
interface MBOEvent {
  type: "mbo";
  provider; environment; symbol; exchange; timestamp; sequence;
  orderId: string;
  side: Side;
  price: number;
  quantity: number;
  action: "add" | "update" | "remove" | "execute";
}
```

## 6. OHLCV Bar

```ts
interface Bar {
  t: number;        // bar open timestamp (UTC ms)
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  buyVol?: number;   // when the provider supplies buy/sell volume split
  sellVol?: number;
}

type BarEvent = Bar & {
  type: "bar";
  provider: ProviderId;
  environment: Environment;
  symbol: string;
  timeframe: Timeframe;
};
```

Bars are aligned to timeframe buckets via `alignToTimeframe(utcMs, tf)` in
`session.ts`. A bar is emitted per bucket regardless of session (overnight
bars carry lower volume in the mock provider).

### Timeframe

```ts
type Timeframe =
  | "1m" | "5m" | "15m" | "30m"
  | "1h" | "4h"
  | "1d" | "1w";

const TIMEFRAME_SECONDS: Record<Timeframe, number>;  // e.g. "5m" → 300
```

## 7. Contract metadata

Futures are **NOT** perpetual — expiry is modeled explicitly.

```ts
interface ContractMetadata {
  root: string;            // "NQ"
  symbol: string;          // "NQ" (front-month) or "NQH5" (specific)
  description: string;     // "E-mini Nasdaq-100 Futures"
  exchange: Exchange;
  product: "future" | "equity" | "index";
  tickSize: number;        // minimum price increment
  tickValue: number;      // $ value of one tick per contract/share
  multiplier: number;     // point multiplier (futures) or 1 (equities)
  currency: "USD";
  expiry?: string;         // ISO date for futures (3rd Friday, quarterly Mar/Jun/Sep/Dec)
  session: SessionId;      // "cme" | "equity"
  supportsDepth: boolean;  // true only when the provider genuinely supplies depth
  supportsMBO: boolean;    // true only when the provider genuinely supplies MBO
}
```

The modeled universe lives in `src/lib/market/contracts.ts`:
**NQ, MNQ, ES, MES** (CME futures) and **QQQ, SPY** (equities).

## 8. Execution domain

These types are modeled for analytics and backtesting only — **no real orders
are routed.** See `SECURITY.md`.

```ts
type OrderSide = Side;                          // "buy" | "sell"
type OrderType = "market" | "limit" | "stop" | "stop_limit";
type OrderStatus =
  | "pending" | "working" | "filled"
  | "partially_filled" | "cancelled" | "rejected";

interface Order {
  id: string;
  strategyId?: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  qty: number;
  filledQty: number;
  limitPrice?: number;
  stopPrice?: number;
  tif: "day" | "gtc" | "ioc" | "fok";
  status: OrderStatus;
  avgFillPrice?: number;
  createdAt: number;
  updatedAt: number;
}

interface Execution {
  id: string;
  orderId: string;
  symbol: string;
  side: OrderSide;
  qty: number;
  price: number;
  commission: number;
  timestamp: number;
}

interface Position {
  symbol: string;
  net: number;
  avgPrice: number;
  realized: number;
  unrealized: number;
}

interface AccountSnapshot {
  accountId: string;
  environment: Environment;
  balance: number;
  equity: number;
  marginUsed: number;
  marginAvailable: number;
  currency: "USD";
}
```

## 9. Connection and data status

```ts
type ConnectionState =
  | "disconnected" | "connecting" | "connected"
  | "reconnecting" | "degraded" | "error";

type DataStatus = "LIVE" | "HISTORICAL" | "DELAYED" | "SIMULATED" | "DISCONNECTED";
```

The workspace store surfaces a single `connection` object
`{ state, provider, environment, dataStatus }` so the UI can label every
panel. When `provider === "mock"`, `dataStatus` MUST be `"SIMULATED"` and
every panel displaying data must show the `SimulatedTag` badge.
