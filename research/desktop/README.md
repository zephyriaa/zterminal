# ZTerminal Research Helper — free private Windows x64 preview

This package is private and unsigned. It is not a public installer or a paid offering. Public downloads remain gated.

Extract the complete ZIP and open `ZTerminalResearchHelper.exe`. Choose **Install for my user** once to copy the private runtime to your local application folder and create a Start Menu shortcut. No system Python, administrator rights, cloud credentials or per-test command line is required. Open the helper from Start Menu when researching. Closing its window stops active jobs.

Open ZTerminal → Research, enter the eight-digit code, and pair once. Allow the site's local-network permission if your browser requests it. Pairing is specific to the exact website origin. Codes expire after ten minutes or one successful pairing. Requesting a new code restarts the helper and cancels an active run; existing paired browsers retain their authentication.

Python executes locally with your user permissions. Process limits are **not a secure sandbox**. Scripts can access local files and the network. Run only code you trust. No application credentials are passed into the strategy process. The API binds only to `127.0.0.1:47321`, checks exact host and origin, and requires a paired bearer token. It does not use cookies.

## Research contract

Define `strategy(data, params)` returning `zt.Strategy(entries, exits, short_entries=None, short_exits=None, plots={})`. `data` is a UTC-indexed pandas DataFrame with `open`, `high`, `low`, `close`, `volume`. Signals must be aligned boolean Series without missing values. Named plots must be aligned numeric Series. Import `zterminal as zt`; `ema`, `sma`, `rsi`, `crossover`, and `crossunder` are available. Bundled vectorbt can also produce signals. Unsupported languages and outputs fail explicitly.

The engine shifts completed-bar signals to the next open. One position, no leverage, no pyramiding, no automatic reversal. Opposite entries while holding are ignored. Costs, cash allocation and provider quantity units are captured with source, parameters and data. Funding, liquidation, leveraged margin and market impact are unmodeled. Arbitrary Python can introduce look-ahead bias; signal shifting cannot prove a user's strategy causal.

Archives and scripts live in `%LOCALAPPDATA%\ZTerminal\ResearchPreview\research.sqlite3`; installed binaries occupy a separate versioned folder. SQLite commits source, dataset and successful result together. Reopening a run needs no market connection. JSON exports are non-executable and validated on import. Legacy records are preserved explicitly as incomplete. Browser drafts use IndexedDB; export source when browser storage is unavailable.

Risk ratios use complete UTC daily return observations, a 365-day crypto calendar, zero risk-free/target return, and at least 30 daily observations. CAGR needs 365.25 days. Missing or undefined values have explanations. Bootstrap Monte Carlo resamples closed-trade account returns independently **with replacement** using a recorded seed. It explores historical observations, not forecasts.

## Building the private package

Use CPython **3.12.10 Windows x64 embedded ZIP** from `https://www.python.org/ftp/python/3.12.10/python-3.12.10-embed-amd64.zip`. Verify its hash against `runtime-source.json`. Extract into `out/research-runtime`; enable `import site` and add `Lib/site-packages` in `python312._pth`. Bootstrap pip in this isolated runtime, then install `requirements.lock` with that runtime's `python.exe -m pip install -r research/desktop/requirements.lock`. Add `../../research/desktop` to the development `_pth` for tests.

Run `out/research-runtime/python.exe -m unittest discover -s research/desktop -p "test_*.py" -v`. Build with `powershell -ExecutionPolicy Bypass -File research/desktop/build-private.ps1`. The build verifies Python/vectorbt versions, includes dependency license metadata, compiles the GUI launcher, records file hashes, and produces an ignored private ZIP. It does not upload or publish it.

Standard SDK strategies avoid per-run vectorbt portfolio compilation. A cached two-year hourly example is measured separately from data download and first initialization. Strategies that import vectorbt directly can still compile kernels on first use. Jobs have a 180-second wall limit, 120-second CPU limit, 2 GB memory limit and one-process Windows Job Object. Only one job runs at a time. A stopped process or disk failure cannot create a successful result.

Keep the complete package and its license notices together. See THIRD-PARTY-NOTICES.md and VECTORBT-LICENSE.md.
