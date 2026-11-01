# REA for ZTerminal research

## Setup status

REA **6.7.0** was installed through npm's package runner and registered for Codex
on 2026-10-18. Setup returned `ready`: the Codex registration and bundled skill
both passed verification (`aligned`). An earlier registry-access failure is resolved.
ZTerminal's application dependencies were not changed.

- MCP registration: `C:\Users\aykhank\.codex\config.toml`
- Original configuration backup: `C:\Users\aykhank\.codex\config.toml.rea.backup`
- Bundled skill: `C:\Users\aykhank\.agents\skills\reverse-engineer-anything`
- Server command: `cmd.exe /d /c npx -y rea-agents@6.7.0 mcp`

Restart Codex to load the new server and skill into future sessions. Setup and
doctor verify saved configuration; the current chat's tools do not hot-reload.
No native decompiler provider is configured (`environment_healthy: false`).
A separate MCP smoke check started the registered command, completed the client
handshake with `rea` 6.7.0, listed 207 tools (including `binary_session`), and
closed the connection successfully. This verifies server startup independently
of loading it into the current Codex chat.

To update later, run from the repository root with registry access:

```powershell
& .\scripts\setup-rea.ps1
```

The script uses the official `rea-agents` npm package and configures only Codex.
Setup installs the matching workflow instructions and pins the MCP registration
to the package version it actually runs. This registration is user-wide, not
limited to ZTerminal. Restart Codex after successful setup.

Check readiness afterward:

```powershell
npx --yes rea-agents@6.7.0 doctor --client codex --skill --json
```

Doctor checks prerequisites and saved registration, not the active MCP connection.
Confirm that REA tools appear after restart. Optional engine failures do not
necessarily block JavaScript or .NET inspection. Node 22.23.2 was present during
installation and meets REA's documented runtime requirement. Match the doctor
package version to the registration after future updates.

Static JavaScript/Electron and .NET analysis need no native decompiler. Website
inspection needs a Chrome-family browser. Native analysis needs a separately
configured provider; Windows Ghidra support is experimental. No commercial
tools or native engines are installed by this script.

## Future feature investigations

Use TradingView, ATAS, and DeepCharts as research references. Choose one concrete
feature per investigation; do not start with a whole-platform reconstruction.
Start with public documentation and observable interactions. Use REA where
authorized inspection can answer a specific unresolved implementation question.
Record target version, environment, inputs, evidence, and uncertainty. REA cannot
reveal a website's server-side implementation merely by inspecting its client.

Separate observed behavior from inferred internals. Write a behavioral spec in
your own words, then implement and verify an original ZTerminal solution.
Do not import competitor source, assets, or market data into ZTerminal.
Use official data interfaces and document the required tick/L2 history.

Suggested investigation order (not claims of existing competitor behavior):

| Area | Questions to measure | ZTerminal acceptance target |
| --- | --- | --- |
| Drawings | Hit testing, anchors, snapping, editing, undo, persistence | Correct anchors after pan/zoom/reload; consistent keyboard and pointer interaction |
| Replay | Event ordering, seek, rebuilding studies | Identical state for identical events and seek position; no future-data leakage |
| Footprint / profile | Trade classification, aggregation, sessions | Documented formulas and reproducible results against known tick fixtures |
| DOM / tape | Snapshot bridging, gaps, ordering, rendering under load | Detect sequence gaps; rebuild correctly; measure latency and memory |
| Research workflow | Authoring, run state, costs, result provenance | Reproducible fills and metrics with visible assumptions and input hashes |

Call an implementation better only after comparing the same task with recorded
accuracy, task time, interaction count, latency, memory, or accessibility results.
Until then, improvements are hypotheses. Installing REA alone implements none of
these features.

Improvement hypotheses to evaluate in ZTerminal: one synchronized replay cursor
across chart, footprint, DOM and tape; a selected price/time region that opens a
reproducible research run; visible data-gap and trade-classification provenance;
and consistent keyboard commands with undo across drawing and workspace actions.
These are proposed directions, not verified gaps in competing platforms.

## Official references

- https://github.com/morluto/rea
- https://github.com/morluto/rea/blob/main/docs/installation.md
- https://github.com/morluto/rea/blob/main/docs/client-configuration.md

The main branch can document unreleased capabilities. Follow the installed
server's advertised schemas and readiness results rather than assuming every
feature in the repository is in the npm release.
