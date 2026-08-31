# ZTerminal

ZTerminal is an open-source trading workspace that brings charting, strategy development, backtesting, order-flow analysis, market research, and review into one coherent workflow.

![ZTerminal](assets/readme-hero.svg)

> **Research → Validate → Monitor → Decide → Execute → Review**

## Product idea

The terminal is designed for people who want context before action: market structure, strategy evidence, risk, alerts, and trade review should live together instead of being scattered across disconnected tools.

## Architecture direction

ZTerminal follows a **client-first, server-light** direction. Computation-heavy work such as chart rendering, indicator calculations, backtesting, Monte Carlo analysis, and local caching should use the user's machine where practical. Central services remain responsible for shared concerns such as authentication, entitlements, synchronization, and authoritative account data.

See the existing [architecture diagram](assets/zterminal-architecture.svg) and research SDK materials for deeper context.

## Repository areas

| Area | Purpose |
| --- | --- |
| `client/` | Desktop and interface-oriented application code. |
| `server/` | Shared services and API boundaries. |
| `research/` | Research workflows and SDK experiments. |
| `docs/` | Product, architecture, and implementation notes. |

## Status

This is an active product and architecture study. Interfaces and boundaries may evolve as research and implementation become more concrete.

## License

See [LICENSE](LICENSE).
