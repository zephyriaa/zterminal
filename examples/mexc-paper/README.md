# Offline execution-foundation example

These are **synthetic fixture quotes and synthetic instrument filters**, not current MEXC data or current MEXC contract specifications. The runner makes no network calls and needs no API credentials. It currently models one Spot symbol and one deployment per ledger. Fills and balances are always paper.

From the repository root in a configured Windows developer shell:

```powershell
cargo build -p zt-execution-paper
$paperLedger = Join-Path $env:TEMP ('zt-paper-' + [guid]::NewGuid().ToString('N') + '.sqlite3')
Get-Content examples/mexc-paper/commands.jsonl | & ./target/debug/zt-execution-paper.exe $paperLedger examples/mexc-paper/config.json
```

The final status contains a paper position of `1`, cash equivalent to `9899.9` and fees of `0.1`. Decimal strings may retain trailing zeroes. Quit stops the runner and cancels unsent paper orders; it does not liquidate the paper position. The ledger stays at the printed/selected path for inspection and restart. Opening the same ledger again preserves balances, starts paused, cancels queued decisions and requires a new quote plus explicit resume. Do not delete a ledger to resolve uncertainty about real orders; this runner cannot place any.

Configuration is immutable for an existing ledger: changing it requires a different explicitly chosen paper ledger. All monetary input must be decimal strings. The command stream accepts only quote, resume, place_limit, cancel, pause, kill_switch, status and quit. Lines/configuration are bounded to 16KB; unknown fields and operations are rejected without echoing their values. This stdin interface is an internal offline tool, not an authenticated strategy IPC endpoint.

See [implementation status and remaining gates](../../docs/implementation/mexc-execution-foundation-status.md).
