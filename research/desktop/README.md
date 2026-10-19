# ZTerminal Research Helper — Windows x64 preview 1.1.0-preview.1

This is an unsigned preview, distributed as a complete portable ZIP. It is separate from the ZTerminal Windows workstation. SHA-256 checksums establish file integrity; they do not establish a publisher signature or an independent security review.

Download → **Extract all** → open `ZTerminalResearchHelper.exe` → **Copy Code** → **Connect Helper** in the website's **Python Strategy** tab. Keep the runtime, app directory and license notices together. Optionally choose **Install / update for my user** to copy the complete runtime to a versioned local application folder and create a Start Menu shortcut. No system Python or administrator rights are required. Windows may warn about this unsigned application. Closing its window stops active jobs.

Open https://zterminal.dpdns.org/terminal → Python Strategy, enter the eight-digit code, and connect. Allow the site's local-network permission if your browser requests it. Pairing is specific to the exact website origin. Codes expire after ten minutes or one successful pairing, and lock after five attempts. **New Code** rotates the code without restarting the service or cancelling a run; existing paired browsers retain their authentication. “Ready” means the service is running. “Browser connected” means authenticated activity occurred within the last 15 seconds, not a permanent connection guarantee.

To update, close the old Helper, extract the new complete ZIP into a fresh folder and choose **Install / update for my user**. Archives and paired-client records remain outside the versioned package folder. Previous packages are retained. A second launch reveals the existing window; close it first to switch package versions. A port-conflict error leaves the existing service and its pairing metadata alone. The Helper never kills unrelated Python processes.

Python executes locally with your user permissions. Process limits are **not a secure sandbox**. Scripts can access local files and the network. Run only code you trust. No application credentials are passed into the strategy process. The API binds only to `127.0.0.1:47321`, checks exact host and origin, and requires a paired bearer token. It does not use cookies.

## Research contract

Define `strategy(data, params)` returning `zt.Strategy(entries, exits, short_entries=None, short_exits=None, plots={})`. `data` is a UTC-indexed pandas DataFrame with `open`, `high`, `low`, `close`, `volume`. Signals must be aligned boolean Series without missing values. Named plots must be aligned numeric Series. Import `zterminal as zt`; `ema`, `sma`, `rsi`, `crossover`, and `crossunder` are available. Bundled vectorbt can also produce signals. Unsupported languages and outputs fail explicitly.

The engine shifts completed-bar signals to the next open. One position, no leverage, no pyramiding, no automatic reversal. Opposite entries while holding are ignored. Costs, cash allocation and provider quantity units are captured with source, parameters and data. Funding, liquidation, leveraged margin and market impact are unmodeled. Arbitrary Python can introduce look-ahead bias; signal shifting cannot prove a user's strategy causal.

Archives and scripts live in `%LOCALAPPDATA%\ZTerminal\ResearchPreview\research.sqlite3`; installed binaries occupy a separate versioned folder. SQLite commits source, dataset and successful result together. Reopening a run needs no market connection. JSON exports are non-executable and validated on import. Legacy records are preserved explicitly as incomplete. Browser drafts use IndexedDB; export source when browser storage is unavailable.

Risk ratios use complete UTC daily return observations, a 365-day crypto calendar, zero risk-free/target return, and at least 30 daily observations. CAGR needs 365.25 days. Missing or undefined values have explanations. Bootstrap Monte Carlo resamples closed-trade account returns independently **with replacement** using a recorded seed. It explores historical observations, not forecasts.

## Building the private package

Use CPython **3.12.10 Windows x64 embedded ZIP** from `https://www.python.org/ftp/python/3.12.10/python-3.12.10-embed-amd64.zip`. Verify its hash against `runtime-source.json`. Extract into `out/research-runtime`; enable `import site` and add `Lib/site-packages` in `python312._pth`. Bootstrap pip in this isolated runtime, then install `requirements.lock` with that runtime's `python.exe -m pip install -r research/desktop/requirements.lock`. Add `../../research/desktop` to the development `_pth` for tests.

Run `out/research-runtime/python.exe -m unittest discover -s research/desktop -p "test_*.py" -v`. Build with `powershell -ExecutionPolicy Bypass -File research/desktop/build-private.ps1`. The build verifies Python/vectorbt versions, includes dependency license metadata, compiles the GUI launcher, records file hashes, and produces an ignored private ZIP. It does not upload or publish it.

For a source service, run `out/research-runtime/python.exe -B research/desktop/server.py` (use `--data-dir` for a disposable test archive). Windows venv redirectors need a second Python process and are rejected before supervised jobs are created; the one-process, memory and CPU limits remain in force. `.venv-research` is for the separate research API tests, not the browser Helper supervisor.

Standard SDK strategies avoid per-run vectorbt portfolio compilation. A cached two-year hourly example is measured separately from data download and first initialization. Strategies that import vectorbt directly can still compile kernels on first use. Jobs have a 180-second wall limit, 120-second CPU limit, 2 GB memory limit and one-process Windows Job Object. Only one job runs at a time. A stopped process or disk failure cannot create a successful result.

## Synthetic research extension

The browser selects `synthetic_next_open_v2` with `researchSchema: 2` results.
Legacy and native CSV/spot contracts remain supported. Synthetic long/short
entries reserve notional, and cash + reserved capital + unrealized P&L = equity.
Decimal sizing, adverse tick rounding, minimum sizes, spread separate from
slippage, per-fill fees and explanatory order/fill ledgers are retained. Stops,
targets, limits, margin, funding, borrowing and liquidation remain unsupported.

By default the last 20% is reserved before user Python runs. Dataset coverage and
executed coverage are shown separately. Training-only bounded-grid selection,
chronological validation and expanding walk-forward folds freeze the parameter
selection before an explicit final-holdout request. All holdout requests count,
including failed/cancelled ones. Unreserved earlier backtests expose the holdout.

Research artifacts are immutable, separately hashed records linked to the base
result. The `/v1/results/:id/analyses` endpoint supports validation, holdout and
Monte Carlo jobs. JSON research bundles retain these artifacts with the source
and dataset and import without executing Python. The legacy IID endpoint remains
available for old clients.

Research-analysis jobs permit 1800 seconds wall, 1200 seconds CPU, 2 GB memory and
one process. Limits include 100 grid combinations, two million evaluated bars and
ten million sampled observations including block-length sensitivity. Progress
and cancellation use the existing job lifecycle. These are resource limits, not
a secure sandbox. Complete semantics and assessment rules are documented at
`/docs/python-research` and in the implementation ledger. MultiCharts comparison,
publisher signing and public deployment have not been performed.

Saved Python indicator evaluations retain their dataset and bind cache identity to
the saved artifact revision, source, supplied parameters, output definitions and
exact market/range/candle identity. Current web clients require the
`indicator_dataset_v2` capability. Older evaluations remain readable, but must be
evaluated again before chart reuse. A saved evaluation displays only against
matching captured candles; changing the chart does not recalculate Python.

Keep the complete package and its license notices together. See THIRD-PARTY-NOTICES.md and VECTORBT-LICENSE.md.
