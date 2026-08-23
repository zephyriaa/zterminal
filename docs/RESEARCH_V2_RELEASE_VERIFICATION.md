# Research V2 Preview Release Verification

**Release commit:** `4d38cb3` (`feat: introduce python rust research foundation`)

**Deployment:** Render service `zterminal` (`srv-d9uogdajobas73bbnn1g`) accepted an explicit latest-commit deployment and reported the commit live at `https://zterminal.onrender.com` on 2026-08-23.

| Public check | Expected behavior | Verified result |
| --- | --- | --- |
| `/` | Landing page remains public | `200` |
| `/terminal` | Terminal remains public and uncached | `200`; `Cache-Control: no-store, max-age=0, must-revalidate` |
| `/docs/python-research` | Python-first authoring documentation is available | `200`; Python Research marker present |
| `/docs/zscript` | ZS is an archival/migration page | `200`; archival marker present |
| `POST /api/strategy` | Retired ZS API fails explicitly | `410`; retirement marker present |
| `POST /api/backtest` | Retired ZS API fails explicitly | `410`; retirement marker present |
| `POST /api/research/artifacts/validate` | No local fallback or execution occurs without the dedicated Python API | `503`; `RESEARCH_API_UNAVAILABLE` marker present |

The Render build completed Next.js compilation, TypeScript checking, static-page generation, image export, and runtime startup successfully. The startup log confirms the public service is live. It also records Binance REST `418` responses during contract discovery; the established gateway retry and fail-closed data behavior remains active and was not replaced with synthetic or cross-provider data.

## Safety boundary retained

This is a **preview architecture release**. The browser UI, TypeScript proxy, Python API contract, Pine-review scaffolding, Rust deterministic core, SDK, tests, and PostgreSQL schema are delivered. Public Python artifact execution, queued research runs, and executable backtests deliberately remain unavailable until a dedicated Python API, isolated worker, PostgreSQL instance, Rust-core integration, queue, artifact storage, and observability controls are separately deployed and evidenced.

## Terminal browser observation

A live terminal request exposed the expected public workstation controls: verified-market selection, read-only research mode, indicators, strategy/backtesting, market context, chart timeframe controls, replay, chart refresh, and floating-window minimize/maximize/resize controls. The chart canvas advertised the retained TradingView-style pan, pinch-density, price-scale, and reset interactions. The browser session then reset before the strategy window could be opened for a second visual assertion; the deployed route and API contract checks above remain the authoritative release checks.
