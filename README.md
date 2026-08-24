<p align="center">
  <img src="zterminal.png" alt="ZTerminal" width="180" />
</p>

<h1 align="center">ZTerminal</h1>

<p align="center">
  <strong>Quantitative market intelligence for everyone.</strong>
</p>

<p align="center">
  Research · Market Context · Order Flow · Risk · Alerts · Journaling
</p>

<p align="center">
  <a href="https://zterminal.onrender.com">Web App</a>
  &nbsp;·&nbsp;
  <a href="#windows-desktop">Windows Desktop</a>
  &nbsp;·&nbsp;
  <a href="#roadmap">Roadmap</a>
  &nbsp;·&nbsp;
  <a href="#contributing">Contributing</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/status-in%20development-111827?style=flat-square" />
  <img src="https://img.shields.io/badge/web-live%20development-111827?style=flat-square" />
  <img src="https://img.shields.io/badge/desktop-Windows%2010%2F11-111827?style=flat-square" />
  <img src="https://img.shields.io/badge/focus-quant%20research-111827?style=flat-square" />
</p>

<p align="center">
  <img src="assets/dashboard.png" alt="ZTerminal dashboard" width="900" />
</p>

---

## What is ZTerminal?

ZTerminal is a **quantitative market research, decision-support, and trading terminal project** for traders who want more than charts and disconnected indicators.

It brings market context, strategy research, statistical validation, risk analysis, alerts and trade review into one workflow.

> **Don't trade because a chart looks right. Trade because you understand the setup.**

The core workflow is:

**Research → Validate → Monitor → Decide → Execute → Review**

The final decision stays with the trader.

---

## The ZTerminal strategy

ZTerminal is evolving from a primarily web-based application into a **web + lightweight Windows terminal platform**.

The web application remains the accessible, cross-platform experience. The Windows client is being designed as the high-performance environment where appropriate computation and rendering can happen locally on the user's computer instead of requiring every heavy workload to run on shared infrastructure.

```text
                         ZTERMINAL
                             │
              ┌──────────────┴──────────────┐
              │                             │
             WEB                       WINDOWS DESKTOP
              │                             │
       Accessible anywhere          Local-first processing
       Shared platform              Native rendering direction
       Account / cloud sync         CPU / GPU utilization
                                    Local persistence
                                    Background monitoring
              └──────────────┬──────────────┘
                             │
                      SHARED PLATFORM
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
    MARKET DATA          ANALYTICS            RESEARCH
        │                    │                    │
    Order Flow            Profiles            Backtests
    Volume                Regimes             Monte Carlo
    Liquidity             Volatility           Walk-Forward
    Sessions              Context              OOS Testing
        └────────────────────┼────────────────────┘
                             │
                            RISK
                             │
                           ALERTS
                             │
                         DECISION
                             │
                         EXECUTION
                             │
                          JOURNAL
```

The goal is **not** to put the website inside an `.exe`. The goal is to build a proper lightweight desktop terminal around the same ZTerminal platform.

---

## Why local-first Windows?

A browser-based product can place substantial rendering, analytics and data-processing workloads on shared infrastructure. As the user base grows, avoiding unnecessary centralized computation becomes increasingly valuable.

The Windows strategy is therefore **local-first where practical**:

```text
USER PC
 ├─ Chart rendering
 ├─ Order-flow visualization
 ├─ Local analytics
 ├─ Workspace state
 ├─ Background monitoring
 └─ CPU / GPU compute
          │
          ▼
   Lightweight server services
          │
   ├─ Authentication
   ├─ Entitlements
   ├─ Shared data / services
   ├─ Cloud synchronization
   ├─ Remote configuration
   └─ Release distribution
```

This does not mean eliminating servers. Central infrastructure remains responsible for functionality that genuinely requires centralized coordination. The local/server boundary will be refined through benchmarking and implementation.

---

## Core capabilities

### Market Intelligence

* VWAP
* Opening Range
* Volume Profile
* POC / VAH / VAL
* HVN / LVN
* Order Flow
* Volatility
* Market Regimes
* Session Context

### Quantitative Research

* Strategy rules
* Historical backtesting
* Expectancy
* Profit factor
* Drawdown
* R-multiple analysis
* Monte Carlo
* Walk-forward testing
* Out-of-sample analysis

### Risk & Decision Support

* Position sizing
* Stop / target planning
* Dollar risk
* R:R
* Exposure
* Drawdown monitoring
* Risk limits

### Monitoring & Review

* Context-aware alerts
* Setup monitoring
* Trade journaling
* Execution analysis
* Strategy performance
* Trader performance
* Historical comparisons

---

## Windows Desktop

The long-term Windows application is being designed as a **lightweight native terminal**, not as a browser wrapper.

The native direction is centered around **Rust + native Windows technologies such as Win32/Direct3D**, with local-first computation and rendering where it provides a meaningful performance benefit.

The intended desktop experience includes:

* Native high-performance rendering
* CPU/GPU utilization on the user's machine
* Local chart and order-flow processing where practical
* Persistent local workspaces
* Multi-window and multi-monitor workflows
* Native notifications
* Global shortcuts
* Background monitoring
* Lower dependence on centralized compute
* A dedicated Windows terminal experience

The current Tauri-based Windows build is treated as an **internal packaging/proof track**, not as the final native architecture. Early installer/package validation is deliberately separated from the longer-term native terminal implementation.

### Web + Windows, not Web vs. Windows

**Web** provides instant, cross-platform access without installation.

**Windows** provides the dedicated high-performance terminal environment with local-first processing and deeper desktop integration.

Both are intended to use the same ZTerminal account and shared platform rather than becoming separate products.

---

## Desktop distribution and automatic updates

A core part of the Windows strategy is to make the desktop client behave like a continuously maintained product.

Users should **not** have to return to the website and manually reinstall ZTerminal for every release.

```text
Developer
   ↓
Git / CI
   ↓
Build + Tests
   ↓
Code Signing
   ↓
Release Artifact
   ↓
Canonical Release Metadata
   ├───────────────┐
   ↓               ↓
Website        Windows Updater
   ↓               ↓
Download       Background Update
                   ↓
              Safe Restart
```

There will be **one release source of truth** for the website and Windows updater.

The release architecture is designed around:

* Signed releases
* Versioned artifacts
* Signed release manifests
* CDN / object-storage distribution
* Background update checks
* Staged rollouts
* Release pause / rollback
* Separation of application binaries from user data

The production distribution system is being implemented incrementally.

---

## Versioned Windows installation

The intended installation model separates application versions from user data:

```text
%LOCALAPPDATA%\\ZTerminal\\
  launcher\\
  versions\\
    <version>\\
  state\\
  user-data\\
```

This provides a path for safer upgrades and rollback without unnecessarily touching user workspaces, settings or other persistent data.

---

## Remote configuration

Not every safe product change should require a full binary release.

ZTerminal is therefore being designed to support **validated remote configuration** for explicitly approved behavior.

```text
Windows Client
      ↓
Remote Config
      ↓
Feature / behavior configuration
```

Remote configuration is not intended to become a mechanism for downloading or executing arbitrary code.

---

## Scalable by design

The Windows strategy is also a scalability strategy.

Instead of assuming every user's expensive workload must be processed centrally:

```text
User 1 ──> Local CPU/GPU ──┐
User 2 ──> Local CPU/GPU ──┤
User 3 ──> Local CPU/GPU ──┤
User N ──> Local CPU/GPU ──┼──> Lightweight shared services
                           ┘
```

The objective is to use each user's hardware for work it can perform efficiently while keeping centralized services focused on identity, shared data, entitlements, synchronization, releases and other server-side responsibilities.

---

## Development strategy

### Track A — Windows packaging proof

Validate:

* Windows builds
* Installer behavior
* Test signing
* Artifact verification
* Controlled internal distribution

This is an engineering proof track, not the final native terminal.

### Track B — Native Windows terminal

Build toward:

* Rust
* Native Windows APIs
* Direct3D / native rendering
* Local-first computation
* High-performance charting
* Order-flow visualization
* Persistent workspaces
* Desktop integration

### Shared release spine

Both tracks follow the same direction for:

* Versioning
* Release metadata
* Signing
* Distribution
* Update strategy
* Rollback
* Remote configuration

Public Windows distribution should only be enabled when the appropriate production gates have passed.

---

## Roadmap

### Research

* [x] Initial research workflow
* [x] Strategy-oriented foundation
* [ ] Advanced backtesting
* [ ] Monte Carlo analysis
* [ ] Walk-forward validation
* [ ] Parameter sensitivity
* [ ] Expanded statistical research

### Market Intelligence

* [ ] Advanced market-regime detection
* [ ] Deeper volume-profile analytics
* [ ] Expanded order-flow analysis
* [ ] Cross-market context
* [ ] Additional real-time data integrations

### Risk & Monitoring

* [ ] Advanced risk engine
* [ ] Context-rich alerts
* [ ] Exposure analytics
* [ ] Advanced trade-plan workspace

### Review

* [ ] Automated journaling
* [ ] Execution analytics
* [ ] Strategy vs. trader performance
* [ ] Performance attribution

### Windows Desktop

* [ ] Internal Windows packaging validation
* [ ] Signed installer pipeline
* [ ] Native Windows client foundation
* [ ] Rust / native rendering architecture
* [ ] Direct3D charting foundation
* [ ] Local-first analytics
* [ ] Persistent workspaces
* [ ] Multi-window / multi-monitor workflows
* [ ] Native notifications
* [ ] Global shortcuts
* [ ] Background monitoring
* [ ] Windows auto-update system
* [ ] Canonical release manifest
* [ ] CDN / object-storage distribution
* [ ] Staged releases and rollback
* [ ] Public Windows download

### Platform

* [ ] Shared web/desktop account architecture
* [ ] Remote configuration
* [ ] Cloud synchronization where appropriate
* [ ] Release management tooling
* [ ] Production observability

> The roadmap is intentionally iterative. Architecture and features are prioritized by usefulness, performance, reliability and research quality rather than feature count.

---

## Philosophy

### Evidence over intuition
A compelling chart is not evidence by itself.

### Context over isolated indicators
A number without context is just another number.

### Risk before conviction
Know what you're risking before thinking about what you might make.

### Robustness over optimization
A stable strategy is more interesting than a perfectly optimized backtest.

### Local compute where it makes sense
Use the user's hardware for work that can be performed efficiently and safely on the client rather than sending everything to centralized infrastructure.

### Human control over blind automation
Automation should remove repetitive work, not remove responsibility.

### Signal over noise
Every component should earn its place.

---

## Status

ZTerminal is an **actively developing project**.

The web application is the current accessible product experience. The Windows architecture is being developed toward a lightweight, native, local-first terminal designed to reduce unnecessary server-side computation and provide a deeper desktop workflow.

The native Windows client, public desktop distribution and automatic-update infrastructure are being developed incrementally and should not be interpreted as fully production-ready merely because they appear in the roadmap.

This repository should be treated as a work in progress rather than a finished institutional trading product.

---

## Contributing

ZTerminal is being developed with a focus on:

* quantitative correctness
* reliable market data
* research integrity
* risk management
* local and server-side performance
* useful UX
* security
* scalable architecture
* maintainability

Before proposing a large feature, ask:

> **Does this make the trading research and decision workflow meaningfully better?**

If not, it probably doesn't belong.

---

## Disclaimer

ZTerminal is software for market analysis, research and decision support.

It does not guarantee profitability or future performance. Backtested results are hypothetical and do not guarantee future results. Market data may be delayed, incomplete or inaccurate. Trading involves substantial risk. Users are responsible for their own decisions and losses.

---

<p align="center">

## Research the market.

## Validate the idea.

## Use your hardware.

## Know the risk.

## Make the decision.

<br>

<strong>ZTerminal</strong>

<sub>Quantitative market intelligence — evolving into a lightweight Windows terminal.</sub>

</p>
