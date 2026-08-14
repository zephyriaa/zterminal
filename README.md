# ZTerminal

<p align="center">
  <img src="/zterminal.png" alt="ZTerminal Logo" width="160">
</p>

<p align="center">
  <strong>A quantitative market research and decision-support terminal built for traders who want evidence, not noise.</strong>
</p>

<p align="center">
  <a href="https://zterminal.onrender.com">Live Platform</a>
  ·
  <a href="#roadmap">Roadmap</a>
  ·
  <a href="#architecture">Architecture</a>
  ·
  <a href="#contributing">Contributing</a>
</p>

---

## What is ZTerminal?

ZTerminal is a trading research and decision-support platform designed to bring **market analysis, quantitative research, strategy validation, risk management, alerts, and trade journaling into one workspace**.

The idea is simple:

> **Don't tell the trader what to buy. Give them better information to make the decision themselves.**

ZTerminal is being built around a systematic workflow:

**Observe → Research → Test → Validate → Manage Risk → Monitor → Execute → Review**

The platform is designed with **manual execution as the final step**. Automation is used for repetitive analysis, calculations, monitoring, and research — not for blindly handing control of the account to a machine.

---

## Why ZTerminal?

Most trading tools force traders to stitch together multiple platforms:

```text
Charts
   +
Market Data
   +
Volume / Order Flow
   +
Backtesting
   +
Risk Calculations
   +
Alerts
   +
Trade Journal
   =
Fragmented Workflow
```

ZTerminal aims to bring that workflow together.

The goal isn't to build another indicator dashboard with hundreds of buttons.

The goal is to build a **focused trading research environment** where every important piece of information has a reason to exist.

---

## Core Philosophy

### Evidence over intuition

A setup should not become "good" because it looks convincing on a chart.

It should be possible to ask:

* How often has this happened?
* Under what conditions?
* What was the average outcome?
* What was the drawdown?
* Does the edge survive different market regimes?
* Does it survive realistic costs and slippage?
* Does it remain valid out of sample?

### Context over isolated signals

A breakout means something different depending on:

* market regime
* volatility
* liquidity
* VWAP
* volume
* market structure
* location within the auction

ZTerminal is designed around **contextual analysis**, not signal spam.

### Risk before execution

A trade idea is incomplete without understanding:

**Entry → Stop → Risk → Position Size → Target → Expected Outcome**

### Human judgment stays in the loop

ZTerminal can automate analysis.

The trader remains responsible for the final decision.

---

# Key Capabilities

## Market Analysis

Built around the concepts that matter when studying market behavior:

* VWAP
* Opening Range
* Volume Profile
* POC / VAH / VAL
* HVN / LVN
* Order-flow analysis
* Volatility
* Market structure
* Session context
* Market-regime analysis

The objective is not to collect indicators.

It's to understand **what the market is actually doing**.

---

## Quantitative Research

ZTerminal is designed to turn trading ideas into testable hypotheses.

A research workflow can move from:

```text
Idea
 ↓
Hypothesis
 ↓
Objective Rules
 ↓
Historical Data
 ↓
Backtest
 ↓
Statistical Analysis
 ↓
Robustness Testing
 ↓
Out-of-Sample Validation
```

Relevant metrics include:

* Expectancy
* Profit Factor
* Win Rate
* Average R
* Maximum Drawdown
* Sharpe Ratio
* Sortino Ratio
* Trade Distribution
* Consecutive Wins / Losses
* Exposure
* Strategy Stability

The objective is to distinguish a genuine statistical edge from something that merely looked good historically.

---

## Strategy Research

Strategies should be expressed as **objective, testable rules** rather than vague chart patterns.

A strategy can define:

```text
Instrument
Timeframe
Session
Entry Conditions
Exit Conditions
Filters
Stop
Target
Risk Model
```

This makes strategies easier to test, compare, version, and improve.

---

## Backtesting & Validation

A backtest is only the beginning.

ZTerminal is being designed around deeper validation techniques, including:

* Historical backtesting
* Out-of-sample testing
* Walk-forward analysis
* Parameter sensitivity
* Monte Carlo analysis
* Bootstrap analysis
* Slippage testing
* Transaction-cost modeling
* Regime analysis

The goal is not:

> "Find the settings that produced the biggest historical profit."

The goal is:

> **Find a behavior that remains reasonably stable when the assumptions change.**

---

## Risk Management

ZTerminal treats risk as a separate system rather than an afterthought.

The platform is designed to help calculate and monitor:

* Position size
* Dollar risk
* Stop distance
* R:R
* Daily risk
* Exposure
* Drawdown
* Risk limits

A profitable strategy with uncontrolled risk is still a bad system.

---

## Alerts & Monitoring

Instead of constantly watching every market manually, ZTerminal can monitor predefined conditions.

Examples:

```text
ORB breakout detected
VWAP interaction detected
Important level reached
Market regime changed
Strategy condition completed
Risk threshold reached
```

The intention is to provide **context-rich alerts**, not meaningless "BUY" or "SELL" notifications.

---

## Trade Journal

Research doesn't end when a trade is executed.

ZTerminal is designed to connect:

**Strategy Performance**

with

**Trader Performance**

This makes it possible to analyze questions such as:

* Did the strategy behave as expected?
* Did the trader follow the rules?
* Were entries late?
* Were exits premature?
* Which setups are consistently mishandled?
* Which market conditions produce the best execution?

The objective is a continuous feedback loop:

```text
Trade
 ↓
Data
 ↓
Analysis
 ↓
Improvement
 ↓
Research
 ↓
Better Process
```

---

# The ZTerminal Workflow

```text
┌──────────────────────┐
│     MARKET DATA      │
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│   MARKET CONTEXT     │
│ VWAP · Profile · ORB │
│ Volatility · Regime  │
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│    RESEARCH ENGINE   │
│ Backtest · Statistics│
│ Validation · OOS     │
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│      RISK ENGINE     │
│ Size · Stop · Risk   │
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│       ALERT          │
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│    HUMAN DECISION    │
│      TAKE / SKIP     │
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│   MANUAL EXECUTION   │
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│     TRADE JOURNAL    │
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│ PERFORMANCE ANALYSIS │
└──────────────────────┘
```

---

# Architecture

ZTerminal is being designed as a **shared platform with multiple clients** rather than two completely separate applications.

```text
                         ZTERMINAL
                             │
              ┌──────────────┴──────────────┐
              │                             │
          WEB CLIENT                  WINDOWS CLIENT
                                              │
                                            TAURI
              │                             │
              └──────────────┬──────────────┘
                             │
                      SHARED PLATFORM
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
      MARKET DATA        ANALYTICS          RESEARCH
          │                  │                  │
          │             VWAP / ORB          BACKTEST
          │             PROFILE             MONTE CARLO
          │             ORDER FLOW          WALK-FORWARD
          │             REGIME              OOS
          │
          └──────────────────┬──────────────────┘
                             │
                           RISK
                             │
                          ALERTS
                             │
                       TRADE PLAN
                             │
                           USER
                             │
                      MANUAL EXECUTION
                             │
                          JOURNAL
```

The architecture is intentionally designed so that the **web and desktop clients share the same core product logic**.

The Windows application is intended to provide a more dedicated terminal experience through capabilities such as native notifications, persistent workspaces, multi-window workflows, and background monitoring.

---

# Web + Windows

ZTerminal is being developed toward a dual-client model.

### Web

Best for:

* instant access
* research
* dashboards
* sharing
* cross-platform usage
* onboarding

### Windows Desktop

Best for:

* dedicated trading workspace
* native notifications
* keyboard shortcuts
* persistent layouts
* multi-window workflows
* background monitoring
* deeper OS integration

The goal is not to wrap a website inside an `.exe`.

The goal is to make the desktop version feel like a **real trading terminal** while keeping the underlying platform unified.

---

# Manual Execution First

ZTerminal is intentionally designed around a **human-in-the-loop** model.

The platform can assist with:

```text
Analysis
Research
Calculation
Validation
Monitoring
Risk
Alerts
Journaling
```

But the final decision remains:

```text
TRADER
   ↓
TAKE / SKIP
   ↓
MANUAL EXECUTION
```

This separation is deliberate.

Automation should reduce repetitive work and improve consistency without creating false confidence or uncontrolled order flow.

---

# Roadmap

ZTerminal is an evolving project.

### Phase I — Foundation

* [x] Core web platform
* [x] Initial terminal interface
* [x] Trading/research workspace
* [x] Strategy-oriented architecture
* [ ] Core architecture cleanup
* [ ] Robust data layer

### Phase II — Quant Research

* [ ] Advanced strategy engine
* [ ] Historical research
* [ ] Backtesting improvements
* [ ] Statistical validation
* [ ] Monte Carlo
* [ ] Walk-forward testing
* [ ] Parameter sensitivity

### Phase III — Decision Support

* [ ] Advanced regime detection
* [ ] Context-rich setup detection
* [ ] Risk engine
* [ ] Advanced alerts
* [ ] Trade-plan workspace

### Phase IV — Performance Loop

* [ ] Automated trade journaling
* [ ] Execution analytics
* [ ] Strategy-vs-trader performance
* [ ] Advanced performance attribution

### Phase V — Desktop

* [ ] Tauri Windows application
* [ ] Native notifications
* [ ] Global shortcuts
* [ ] Multi-window workspaces
* [ ] Background monitoring
* [ ] Secure local persistence

### Phase VI — Long-Term

* [ ] More advanced market microstructure analytics
* [ ] Expanded research infrastructure
* [ ] Advanced portfolio analytics
* [ ] Cross-asset research
* [ ] Additional data integrations

Roadmap items are subject to change as research and engineering progress.

---

# Design Principles

ZTerminal follows a few rules:

**Signal > Noise**

More features do not automatically make a better terminal.

**Evidence > Backtest Hype**

A beautiful equity curve isn't proof of a durable edge.

**Risk > Leverage**

Capital preservation matters more than maximizing position size.

**Context > Indicators**

An indicator without context is often just another number.

**Transparency > Black Box**

Users should understand where an analytical result came from.

**Human Control > Blind Automation**

Automation should assist the trader, not replace judgment by default.

**Useful Complexity > Decorative Complexity**

Every component should earn its place.

---

# Project Status

ZTerminal is an **actively evolving project**.

It should be considered a research and development platform rather than a finished institutional trading product.

Features, calculations, integrations, and architecture are continuously being tested and improved.

Do not assume that every displayed metric or workflow is production-ready simply because it appears in the interface.

---

# Getting Started

Clone the repository:

```bash
git clone <REPOSITORY_URL>
cd zterminal
```

Install dependencies:

```bash
npm install
```

Start the development environment:

```bash
npm run dev
```

> The exact setup commands may change as the architecture evolves. See the repository documentation and environment configuration for the current development workflow.

---

# Contributing

Contributions are welcome, especially where they improve:

* quantitative correctness
* market-data reliability
* backtesting integrity
* risk management
* performance
* UX
* security
* developer experience

Before submitting a major change, please make sure it fits the core direction of the project.

A feature that adds complexity without improving the trading research workflow is not automatically an improvement.

---

# Security

ZTerminal is designed for financial analysis and decision support.

Never commit:

* API keys
* broker credentials
* passwords
* private tokens
* `.env` secrets
* account identifiers

Use environment variables and appropriate secret-management practices.

If you discover a security vulnerability, please report it privately rather than publishing sensitive details in a public issue.

---

# Disclaimer

ZTerminal is a software and research project.

It does **not** guarantee profitable trading, predictive accuracy, or future performance.

Historical backtests are not proof of future results.

Market data can be delayed, incomplete, incorrect, or unavailable.

Any trading decision and its financial consequences remain the responsibility of the user.

---

# The Bigger Idea

ZTerminal is being built around a different approach to trading software.

Not:

> **"Here's a signal. Take the trade."**

But:

> **"Here's the market context. Here's the statistical evidence. Here's the risk. Here's what your system historically did in comparable conditions. Now decide."**

The long-term goal is to create a terminal where **research, execution discipline, and evidence-based decision-making live in the same workflow.**

---

<p align="center">

**ZTerminal**

*Research the market. Validate the idea. Control the risk.*

</p>
