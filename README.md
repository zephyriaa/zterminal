<p align="center">
  <img src="zterminal.png" alt="ZTerminal" width="180" />
</p>

<h1 align="center">ZTerminal</h1>

<p align="center">
  <strong>A Native Windows Quantitative Research Workstation.</strong>
</p>

<p align="center">
  Research • Market Context • Order Flow • Risk • Alerts • Journaling
</p>

<p align="center">
  <img src="https://img.shields.io/badge/status-in%20development-111827?style=flat-square" />
  <img src="https://img.shields.io/badge/platform-native%20windows-111827?style=flat-square" />
  <img src="https://img.shields.io/badge/focus-quant%20research-111827?style=flat-square" />
  <img src="https://img.shields.io/badge/architecture-client%20first-111827?style=flat-square" />
</p>

<p align="center">
  <img src="assets/dashboard.png" alt="ZTerminal dashboard" width="900" />
</p>

---

## What is ZTerminal?

**ZTerminal is a Native Windows Quantitative Research Workstation—not a browser-first platform.** 

Built for high-performance market analysis, ZTerminal operates on a strictly **client-first, server-light** architecture. Rather than relying on expensive cloud compute and suffering from network latency, ZTerminal is engineered as a highly optimized native desktop application for traders who want rigorous statistical validation without the overhead of cloud infrastructure.

> **Don't trade because a chart looks right. Trade because you understand the setup.**

**Research → Validate → Monitor → Decide → Execute → Review**

---

## Core Architecture

ZTerminal is built around moving compute to the edge. The server is minimized to acting purely as a lightweight signaling, licensing, and shared services layer. 

- **Native Windows Desktop (Tauri & Rust):** Wraps a React/Next.js frontend in a highly optimized native shell, granting the UI direct access to the local filesystem and OS-level APIs without browser sandbox constraints.
- **Local Data Ingestion (DuckDB & Parquet):** Historical tick and Market-By-Order (MBO) data are downloaded, compressed into highly efficient `.parquet` files, and saved directly to your hard drive. 
- **Zero-Copy Analytics (Polars):** Backtesting, Monte Carlo simulations, and Walk-Forward optimizations are vectorized using Rust and Polars natively on your machine, preventing look-ahead bias and offloading virtually all computational load from any central server.
- **Professional Charting:** Uses TradingView Lightweight Charts for lag-free rendering of millions of data points, including Volume Profiles, CVD, and Order Flow computed directly on your machine.

```text
                  Cloud Infrastructure
          ┌───────────────────────────────────┐
          │ Lightweight API / Auth / Metadata │
          └─────────────────┬─────────────────┘
                            │ (Low Bandwidth)
                            ▼
                  Native Windows App
          ┌───────────────────────────────────┐
          │ ┌───────────────┐ ┌─────────────┐ │
          │ │ Rust (Tauri)  │ │ React / JS  │ │
          │ ├───────────────┤ ├─────────────┤ │
          │ │ DuckDB (SQL)  │ │ Lightweight │ │
          │ │ Polars (DFs)  │ │ Charts      │ │
          │ │ Parquet I/O   │ │ UI Engine   │ │
          │ └───────────────┘ └─────────────┘ │
          └───────────────────────────────────┘
               (Heavy CPU / RAM Compute)
```

---

## Scalable by design

ZTerminal's architecture is intentionally designed so that **adding users does not mean adding the same amount of server-side compute**.

The preferred scaling model is:

```text
More users
    =
More client-side compute (Free to host)
    +
Minimal growth in shared backend traffic
```

This drastically improves the cost profile of analytics-heavy features because the compute required for one user's massive backtest or tick-data analysis is supplied entirely by that user's own machine.

---

## Security boundary

Client-first does **not** mean trusting the client with authoritative decisions. The server remains the source of truth for security-sensitive operations. 

- Authentication and entitlements are server-controlled.
- Subscription state is validated centrally.
- Sensitive server secrets are never embedded in the client.

The architecture aims to move **compute**, not **trust boundaries**, to the user's machine.

---

## Roadmap

### Research & Strategy Workstation (MultiCharts-Grade Parity)

- [x] Initial research workflow
- [x] Strategy-oriented foundation
- [x] Advanced backtesting (Sub-bar Bar Magnifier, Limit touch/penetrate, Bracket OCOs, Trailing Stops)
- [x] Monte Carlo analysis (1,000-run bootstrap permutations with 50%, 95%, 99% drawdown bounds)
- [x] Walk-forward validation (WFA rolling cycles with Walk-Forward Efficiency WFE scoring)
- [x] Parameter sensitivity (In-browser Grid Search optimizer and 2D response heatmaps)
- [x] Expanded statistical research (Institutional Tear Sheet, Monthly returns matrix, Slippage sensitivity curve)
- [x] Web QuoteManager & Data Caching (IndexedDB 0ms cold-start, Multi-Data streams, CSV/Parquet ingestion)
- [x] PineScript & EasyLanguage to Python transpiler
- [x] Historical Bar Replay scrubber (1x to 50x speed)
- [x] On-chart trade execution overlays (BUY/SELL arrows and PnL tags)

### Market Intelligence
- [x] Lightweight Charts Integration
- [ ] Deeper volume-profile analytics (Local compute)
- [ ] Expanded order-flow analysis (Local compute)
- [ ] Cross-market context
- [ ] Real-time WebSocket streaming enhancements

### Risk & Monitoring
- [ ] Advanced risk engine
- [ ] Context-rich alerts
- [ ] Exposure analytics
- [ ] Advanced trade-plan workspace

### Platform & Deployment
- [x] Windows GitHub Actions CI Pipeline (`.msi` / `.exe`)
- [ ] Remote configuration support
- [ ] Release management tooling
- [ ] Workload benchmarking and cost monitoring

---

## Philosophy

**Evidence over intuition.** A compelling chart is not evidence by itself.

**Robustness over optimization.** A stable strategy is more interesting than a perfectly optimized backtest.

**Local compute where it makes sense.** Use the user's hardware when it is efficient, safe and reliable to do so. A native Windows app outperforms a web app for heavy data lifting.

**Centralize what must be centralized.** Identity, entitlements, authoritative state and shared services belong where centralized control provides real value.

**Minimize unnecessary infrastructure.** Server capacity should be spent on shared platform responsibilities, not avoidable per-user computation.

---

## Status

ZTerminal is an **actively developing project**.

The primary implementation target for this repository is the **Native Windows Desktop Application**. While a web fallback exists for testing and lightweight monitoring, all heavy analytical workflows, backtesting, and advanced charting computations are explicitly designed to run via the native Tauri/Rust client on the user's local operating system.

---

## Contributing

ZTerminal is being developed with a focus on quantitative correctness, reliable market data, research integrity, risk management, performance, security, scalable architecture and maintainability.

Before proposing a large feature, ask:

> **Does this make the trading research and decision workflow meaningfully better?**

And for implementation:

> **Does this really need server-side compute, or can the user's machine handle it natively?**

---

## Disclaimer

ZTerminal is software for market analysis, research and decision support. It does not guarantee profitability or future performance. Backtested results are hypothetical and do not guarantee future results. Market data may be delayed, incomplete or inaccurate. Trading involves substantial risk. Users are responsible for their own decisions and losses.

---

<p align="center">
<strong>ZTerminal</strong><br />
<sub>Quantitative market intelligence / a high-performance, client-first native analysis terminal.</sub>
</p>
