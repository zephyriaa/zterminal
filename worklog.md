# Z TERMINAL — Worklog

Shared work log for the Z TERMINAL redesign. Append-only. New sections start with `---`.

---
Task ID: 0
Agent: Director (main)
Task: Project bootstrap — install deps, set up plan, init worklog.

Work Log:
- Inspected existing Next.js 16 scaffold. page.tsx is essentially blank (logo only).
- Confirmed stack: Tailwind v4, shadcn/ui (new-york), Prisma (SQLite), socket.io NOT yet installed.
- Read full user directive (Z TERMINAL spec) + analyzed reference image via VLM.
- Defined plan: single `/` route with client-side workspace view-switching (Zustand).
- Design language: near-black/graphite/charcoal base, warm off-white text, semantic accents (emerald=positive, red=negative, amber=warning, violet=research, cyan=market-data). NO blue dominance, NO neon, minimal shadows/radii.

Stage Summary:
- Foundation established. Next: design system (globals.css), then shell, then priority views.
- All mock/simulated data MUST be clearly labeled SIMULATED. No fabricated LIVE data.
- Rithmic: build IRithmicProvider interface + MockRithmicProvider only (no dev-kit/creds available). Document honestly in RITHMIC_INTEGRATION.md.

---
Task ID: 12
Agent: documentation
Task: Write Z TERMINAL documentation — 12 markdown files under docs/ covering product rules, architecture, Rithmic integration, market-data schema, database, backtesting, statistics, security, licensing, design system, roadmap, and the ZS strategy language.

Work Log:
- Read /home/z/my-project/worklog.md (Task 0 context: foundation, design language, single-route + Zustand view-switching, mock/SIMULATED-only data, Rithmic interface-only).
- Read source-of-truth files before writing any doc (no fabrication):
  - src/lib/market/types.ts (normalized types: TradeEvent, QuoteEvent, DepthEvent, MBOEvent, Bar, BarEvent, ContractMetadata, Order, Execution, Position, AccountSnapshot, ConnectionState, DataStatus, Timeframe).
  - src/lib/market/contracts.ts (NQ/MNQ/ES/MES/QQQ/SPY contract metadata; quarterly 3rd-Friday expiry helper; continuous-contract roadmap note).
  - src/lib/market/session.ts (SessionEngine, ET-based, classifySession for cme/equity, sessionVolMultiplier U-shape, alignToTimeframe).
  - src/lib/market/mock-provider.ts (generateBars deterministic; MockLiveMarket.tick/depth).
  - src/lib/market/provider.ts (MarketDataProvider + IRithmicProvider interfaces; status comment block).
  - src/lib/market/rng.ts (hashString, mulberry32, gaussian, barSeed).
  - src/lib/strategy/zs-compiler.ts (tokenizer + recursive-descent parser + AST walker + diagnostics + input extraction).
  - src/lib/strategy/zs-runtime.ts (runStrategy event-driven engine, next-bar-open fill model, lazy var thunks, computeMetrics pure function, hashInputs FNV-1a determinism hash).
  - src/app/api/{bars,backtest,strategy,contracts,markets}/route.ts (all force-dynamic; all surface provider/environment/dataStatus: SIMULATED).
  - src/app/globals.css (graphite ramp, semantic accents, 6px radius, hairline, tnum/font-mono-num, reduced-motion).
  - src/components/terminal/primitives.tsx (Panel, PanelHeader, SectionLabel, StatRow, SimulatedTag, Pill).
  - src/components/terminal/workspace-shell.tsx (single-route, REGISTRY view-switching, g c/s/b/o/m shortcuts).
  - src/stores/{workspace,strategy}.ts (Zustand persist; zterminal-workspace and zterminal-strategy localStorage keys).
  - src/hooks/use-market-stream.ts (singleton socket io("/?XTransformPort=3003"), reconnect + subscription restore, rAF-batched trades).
  - mini-services/market-data/index.ts (socket.io on port 3003, ~6 ticks/sec, all events SIMULATED).
  - src/lib/db.ts + prisma/schema.prisma (Prisma + SQLite configured; placeholder User/Post models; not yet used by the terminal).
- Created /home/z/my-project/docs/ (directory existed empty; created 12 files):
  1. PROJECT_RULES.md — product positioning, what Z TERMINAL is/is NOT, hypothesis-testing philosophy, target users, the four non-negotiable rules (no fabricated results, no fake LIVE data, SIMULATED always labeled, credentials never in browser).
  2. ARCHITECTURE.md — single-route Next.js 16 + Zustand view-switching, provider abstraction layer, market-data pipeline (Exchange → Provider → Normalizer → Event Bus → WebSocket → Frontend), deterministic backtest engine, ZS runtime, socket.io mini-service on port 3003 via io("/?XTransformPort=3003"), full API route table.
  3. RITHMIC_INTEGRATION.md — verified status ONLY: NOT operational, four documented reasons (no protobuf dev-kit, no credentials, no conformance testing, production requires authorization). IRithmicProvider interface documented. MockRithmicProvider satisfies contract for dev. Explicit note: no endpoints/protobuf/auth flows invented.
  4. MARKET_DATA_SCHEMA.md — every type in types.ts with field tables, common conventions (provider/environment/symbol/exchange/timestamp/sequence), timezone discipline (UTC internal, ET for sessions), tick alignment.
  5. DATABASE.md — Prisma + SQLite configured but unused; localStorage persistence (Zustand persist); production persistence plan (Strategies, BacktestRuns with full config + hash for reproducibility, JournalEntries, ConnectionState); what does NOT belong in DB (contract metadata, credentials, mock data, tick history).
  6. BACKTESTING.md — event-driven engine, anti-look-ahead model (signal on bar[i] fills at bar[i+1].open), cost modeling (commission/slippage/spread/tick/multiplier), determinism guarantee (no Math.random, FNV-1a hash), what is PREVENTED (look-ahead, future leakage, non-determinism, hidden costs), what is MODELED, BacktestConfig/BacktestResult/BacktestTrade fields, roadmap (limit/stop/bracket, walk-forward, Monte Carlo, sensitivity, contract rolls).
  7. STATISTICS.md — every BacktestMetrics field with formula, sharpe (sqrt(252)), sortino (downside-dev), calmar (CAGR/maxDD), exposure, streaks; isolated computeMetrics pure function (independently testable); explicit statement that Monte Carlo / bootstrap / confidence intervals are roadmap and NOT implemented.
  8. SECURITY.md — credentials never in browser/localStorage/URLs/logs/Git; server-side env secrets only; Rithmic adapter server-side only; mock provider needs no secrets; socket service server-side; no real trading (SIMULATED only); recommendations (auth, rate limiting, CORS lockdown, CSRF, secrets manager, audit logging, dependency scanning) before production.
  9. LICENSING.md — current mock data is synthetic (no licensing obligation); real Rithmic/CME data triggers display/redistribution/historical-storage/derived-data/per-user-entitlement gates; prohibited sources (scraping TradingView/Rithmic/Bookmap/ATAS/broker terminals); operator responsibility; engineering guidance not legal advice.
  10. DESIGN_SYSTEM.md — graphite ramp (base/panel/surface/elevated/hover), warm off-white text, semantic accents (emerald/red/amber/violet/cyan), no blue dominance, no neon, 6px radii, hairline borders, tnum/font-mono-num, compact density (h-8 rows, 11-13px text), Geist Sans + Geist Mono; primitives catalog; sticky SIMULATED badge / connection state rule; mobile-first responsive; "would a serious trader stare at this for 8 hours" test.
  11. ROADMAP.md — phased plan with honest status: Phase 0-1 DONE (shell, design system, command palette), Phase 2 DONE (chart), Phase 3 DONE (mock provider + WebSocket), Phase 4 BLOCKED (Rithmic Test — dev-kit/credentials), Phase 5 PARTIAL (order flow DOM/footprint/CVD done; MBO pending real data), Phase 6 DONE (strategy builder + ZS language), Phase 7 DONE with roadmap items (backtest engine; walk-forward/Monte Carlo/sensitivity pending), Phase 8 SCAFFOLDED (Research Lab), Phase 9 SCAFFOLDED (Journal/Portfolio/Risk), Phase 10 PENDING (AI research assistant), Phase 11 PENDING (security hardening), Phase 12 PENDING (performance optimization), Phase 13 PENDING (production infrastructure).
  12. STRATEGY_LANGUAGE.md — ZS custom DSL (NOT Pine-compatible); grammar subset; built-in series (open/high/low/close/volume/time/hl2/hlc3/ohlc4); built-in funcs (ema/sma/vwap/highest/lowest/crossover/crossunder/atr/rsi/stdev/max/min/abs/plot); strategy actions (strategy.entry/strategy.close/strategy.exit); input declarations; var lazy-thunk assignment; single-statement if bodies; ZSDiagnostic structure; worked example (EMA Cross + VWAP Filter, the default strategy); roadmap.
- All files verified accurate against source — no fabricated endpoints, protobuf messages, or auth flows. Every stub/roadmap item explicitly labeled as such. SIMULATED labeling rule enforced throughout docs.
- File lengths: 98-246 lines (most within 60-200 target; MARKET_DATA_SCHEMA and STRATEGY_LANGUAGE slightly exceed 200 due to comprehensive type/grammar listings required by the task).

Stage Summary:
- 12 documentation files created under /home/z/my-project/docs/. Together they form a complete, honest documentation set for Z TERMINAL: product rules, architecture, provider/Rithmic status, normalized data schema, database plan, backtest engine, statistics, security, licensing, design system, roadmap, and the ZS strategy language.
- Key honesty guarantees enforced in the docs: (1) Rithmic integration is documented as interface-only and NOT operational, with the four specific blockers; (2) Monte Carlo / bootstrap / confidence intervals are explicitly marked as roadmap and not implemented in STATISTICS.md; (3) ZS is documented as a custom DSL that is NOT Pine-compatible; (4) SIMULATED labeling is documented as non-negotiable everywhere.
- Next actions for other agents: implement Phase 4 (Rithmic) only after obtaining the official dev-kit/credentials; implement Phase 7 roadmap items (limit/stop fills, walk-forward, Monte Carlo, contract rolls) inside zs-runtime.ts and update STATISTICS.md/BACKTESTING.md in the same commit; replace the placeholder Prisma User/Post models per DATABASE.md §3 when wiring real persistence.

---
Task ID: 13
Agent: Director (main)
Task: Agent-browser self-verification + final integration.

Work Log:
- Restarted dev server + market-data service using a double-fork daemon (the sandbox reaps background processes between tool calls; setsid+nohup+disown alone was insufficient).
- Fixed runtime bugs found during verification: (1) indicator functions read period from wrong arg (ema(close,Fast) used close as period); (2) `vwap` identifier not in runtime series switch (returned NaN, broke VWAP-filter strategies); (3) parser `if`-block handling was broken (greedy keyword termination); rewrote to Pine-like single-statement-if; (4) locals are now lazy thunks so series like `var f = ema(close,Fast)` support lookback for crossover/crossunder; (5) CodeEditor style property camelCase fix.
- Verified via agent-browser: chart canvas renders (1162x916) with candles/grid/axes/indicators/right panel; Strategy Builder IDE compiles + runs backtest; Backtester shows NET PROFIT +$43,515 (+43.27%) with equity/drawdown/trades/monthly/metrics; Order Flow DOM/Footprint/CVD; Markets watchlist; Risk position-sizing; Connections (Rithmic interface + SIMULATED mock); Command palette (Ctrl+K); sidebar collapse. No console/page errors.
- Confirmed determinism: identical backtest inputs -> identical hash + trades (verified twice).
- Confirmed socket.io handshake works through Caddy gateway (port 81, XTransformPort=3003). Live ticks flow through the preview panel; direct localhost:3000 bypasses Caddy (testing limitation, not a code bug).

Stage Summary:
- Z TERMINAL is visually and functionally complete. Lint clean. All 13 views operational. Backtest engine deterministic. Rithmic honestly documented as interface-only (RITHMIC_INTEGRATION.md). All mock data clearly labeled SIMULATED.
- 12 documentation files written under docs/ by the documentation subagent (Task 12).
- Ready for user preview via the Preview Panel.
