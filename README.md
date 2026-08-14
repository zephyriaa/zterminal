<p align="center">
  <img src="zterminal.png" alt="ZTerminal" width="180" />
</p>

<h1 align="center">ZTerminal</h1>

<p align="center">
  <strong>Quantitative market intelligence for better trading decisions.</strong>
</p>

<p align="center">
  Research · Market Context · Risk · Alerts · Journaling
</p>

<p align="center">
  <a href="https://zterminal.onrender.com">Live App</a>
  &nbsp;·&nbsp;
  <a href="#roadmap">Roadmap</a>
  &nbsp;·&nbsp;
  <a href="#contributing">Contributing</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/status-in%20development-111827?style=flat-square" />
  <img src="https://img.shields.io/badge/platform-web-111827?style=flat-square" />
  <img src="https://img.shields.io/badge/desktop-Windows-111827?style=flat-square" />
  <img src="https://img.shields.io/badge/focus-quant%20research-111827?style=flat-square" />
</p>

<br>

<p align="center">
  <img src="assets/dashboard.png" alt="ZTerminal dashboard" width="900" />
</p>

---

## What is ZTerminal?

ZTerminal is a **quantitative market research and decision-support terminal** built for traders who want more than charts and disconnected indicators.

It brings market context, strategy research, statistical validation, risk analysis, alerts and trade review into one workflow.

> **Don't trade because a chart looks right. Trade because you understand the setup.**

ZTerminal is designed around a simple loop:

**Research → Validate → Monitor → Decide → Execute → Review**

The final decision stays with the trader.

---

## Why ZTerminal?

Trading workflows are usually fragmented.

```text
Charting
   +
Market Data
   +
Volume / Order Flow
   +
Backtesting
   +
Risk Calculator
   +
Alerts
   +
Trade Journal
        ↓
   7 different tools
```

ZTerminal is built around bringing those pieces together.

```text
                    ZTERMINAL

   ┌────────────┬────────────┬────────────┐
   │   Markets  │  Research  │    Risk    │
   └────────────┴────────────┴────────────┘
                     │
                  Alerts
                     │
                  Decision
                     │
               Manual Execution
                     │
                   Review
```

Less context switching.

More context.

---

## Built for the decision, not the signal

A trading system shouldn't stop at:

> **BUY**

It should help answer:

* Where is price relative to value?
* What regime are we in?
* Where is liquidity?
* What does volume say?
* Has this setup worked historically?
* How stable is the result?
* How much am I risking?
* Does the current environment resemble the conditions where the idea actually worked?

That's the direction ZTerminal is being built toward.

---

## Core capabilities

<table>
<tr>
<td width="50%">

### Market Intelligence

Understand the market before acting.

* VWAP
* Opening Range
* Volume Profile
* POC / VAH / VAL
* HVN / LVN
* Order Flow
* Volatility
* Market Regimes
* Session Context

</td>
<td width="50%">

### Quantitative Research

Turn ideas into measurable hypotheses.

* Strategy rules
* Historical backtesting
* Expectancy
* Profit factor
* Drawdown
* R-multiple analysis
* Monte Carlo
* Walk-forward testing
* Out-of-sample analysis

</td>
</tr>

<tr>
<td>

### Risk & Decision Support

Know the risk before the trade.

* Position sizing
* Stop / target planning
* Dollar risk
* R:R
* Exposure
* Drawdown monitoring
* Risk limits

</td>
<td>

### Monitoring & Review

Close the loop after the trade.

* Context-aware alerts
* Setup monitoring
* Trade journaling
* Execution analysis
* Strategy performance
* Trader performance
* Historical comparisons

</td>
</tr>
</table>

---

# One workflow

<p align="center">
  <strong>DATA → CONTEXT → RESEARCH → VALIDATION → RISK → ALERT → DECISION → REVIEW</strong>
</p>

### 01 — Understand the market

Price is only one piece of the puzzle.

ZTerminal is designed to combine price with:

`VWAP` · `Volume` · `Profile` · `Liquidity` · `Volatility` · `Regime`

### 02 — Test the idea

Turn a trading idea into objective rules.

Then test it against historical data.

### 03 — Try to break it

A strategy is more interesting when it survives:

`Out-of-Sample` · `Walk-Forward` · `Monte Carlo` · `Parameter Sensitivity` · `Slippage`

### 04 — Define the risk

Before execution:

`Entry → Stop → Position Size → Risk → Target`

### 05 — Let the terminal watch

Instead of staring at charts all day, let ZTerminal monitor predefined conditions and surface relevant setups.

### 06 — Decide yourself

The platform provides the context.

**You decide whether to take the trade.**

### 07 — Learn from the result

Every trade can become another data point.

That creates the feedback loop:

**Trade → Data → Analysis → Improvement**

---

# Quant research without the spreadsheet maze

The objective isn't to find the prettiest equity curve.

It's to understand whether an idea has a **repeatable, measurable and sufficiently robust behavior**.

A research workflow can look like:

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
Robustness
  ↓
Out-of-Sample
  ↓
Risk Model
  ↓
Live Monitoring
```

The uncomfortable questions matter:

> Does it still work outside the sample?

> How sensitive is it to parameters?

> What happens when volatility changes?

> How bad can the drawdown get?

> What happens after costs and slippage?

> Is there an actual edge — or just a good-looking backtest?

---

# A different approach to automation

ZTerminal is being designed around **human-in-the-loop trading**.

The system can automate the repetitive work:

```text
Research
Analysis
Calculations
Backtesting
Validation
Monitoring
Risk calculations
Alerts
Journaling
```

The trader retains control of:

```text
TAKE
or
SKIP
```

and the actual order execution.

The goal is not:

> **Replace the trader.**

It's:

> **Reduce the work around the decision so the trader can focus on the decision itself.**

---

# Built for context

A breakout by itself doesn't tell you much.

A breakout with context does.

ZTerminal is designed to combine things such as:

```text
Price
 + VWAP
 + Volume
 + Profile
 + Volatility
 + Market Regime
 + Session Structure
 + Historical Statistics
```

The result should be a **decision environment**, not another pile of indicators.

---

# Designed for serious workflows

The long-term product is being built toward two experiences.

### Web

Fast, accessible and cross-platform.

### Windows Desktop

A dedicated terminal experience with plans for:

* Persistent workspaces
* Multi-window layouts
* Native notifications
* Global shortcuts
* Background monitoring
* Local persistence
* Faster terminal-style workflows

The objective is not to put the website inside an `.exe`.

The objective is to build a proper desktop client around the same ZTerminal platform.

---

# Product direction

```text
                     ZTERMINAL
                         │
          ┌──────────────┴──────────────┐
          │                             │
        WEB                         WINDOWS
                                      │
                                    TAURI
          │                             │
          └──────────────┬──────────────┘
                         │
                  SHARED PLATFORM
                         │
       ┌─────────────────┼─────────────────┐
       │                 │                 │
   MARKET DATA       ANALYTICS         RESEARCH
       │                 │                 │
       │            VWAP / ORB        BACKTEST
       │            PROFILE           MONTE CARLO
       │            ORDER FLOW        WALK-FORWARD
       │            REGIME            OOS
       │
       └─────────────────┬─────────────────┘
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

---

# What we're building toward

### Market research

A place to understand what's happening.

### Quantitative validation

A place to test whether an idea actually has evidence behind it.

### Risk intelligence

A place to understand exactly what the trade costs if it goes wrong.

### Decision support

A place where the important information appears together.

### Continuous improvement

A place where historical trades become future research.

---

# Roadmap

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

### Desktop

* [ ] Tauri Windows client
* [ ] Native notifications
* [ ] Global shortcuts
* [ ] Multi-window workspaces
* [ ] Background monitoring
* [ ] Persistent local workspace

> The roadmap is intentionally iterative. Features are prioritized by usefulness rather than feature count.

---

# Philosophy

### Evidence over intuition

A compelling chart is not evidence by itself.

### Context over isolated indicators

A number without context is just another number.

### Risk before conviction

Know what you're risking before thinking about what you might make.

### Robustness over optimization

A stable strategy is more interesting than a perfectly optimized backtest.

### Human control over blind automation

Automation should remove repetitive work, not remove responsibility.

### Signal over noise

Every component should earn its place.

---

# Status

ZTerminal is an **actively developing project**.

The current platform is a foundation for a much broader terminal and research environment. Architecture, analytics, integrations and workflows are still evolving.

This repository should be treated as a work in progress rather than a finished institutional trading product.

---

# Contributing

ZTerminal is being developed with a focus on:

* quantitative correctness
* reliable market data
* research integrity
* risk management
* performance
* useful UX
* security
* maintainable architecture

Contributions that improve those areas are especially valuable.

Before proposing a large feature, consider one question:

> **Does this make the trading research and decision workflow meaningfully better?**

If not, it probably doesn't belong.

---

# Disclaimer

ZTerminal is software for market analysis, research and decision support.

It does not guarantee profitability or future performance.

Backtested results are hypothetical and do not guarantee future results.

Market data may be delayed, incomplete or inaccurate.

Trading involves substantial risk. Users are responsible for their own decisions and losses.

---

<p align="center">

## Research the market.

## Validate the idea.

## Know the risk.

## Make the decision.

<br>

<strong>ZTerminal</strong>

<sub>Quantitative market intelligence — built around the trader.</sub>

</p>
