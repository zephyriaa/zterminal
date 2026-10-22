# Security boundaries

ZTerminal is a research workstation. Market observation and hypothetical results
do not route real orders or custody funds. This document describes current source
boundaries; it is not a penetration-test or production acceptance certificate.

## Public market data

Gate and Binance USDT perpetual data use direct public browser REST/WebSocket
adapters by default. Public requests carry no exchange credentials. Venue access
restrictions and rate limits are surfaced; adapters do not bypass them or silently
switch venues. Opening a socket does not establish live instrument readiness.
Trades and depth have independent quality, identity and sequence checks.

An explicitly configured `NEXT_PUBLIC_MARKET_TRANSPORT=gateway` retains the
existing server gateway compatibility path. Private or licensed adapters must keep
credentials on the server. Only public gateway addresses belong in `NEXT_PUBLIC_*`.
Do not put exchange secrets in browser storage, URLs, client bundles or logs.

Network history retains instrument, source, units and retrieval provenance. Disk
fallback is marked STALE and does not become live merely because it renders.
Legacy unqualified per-bar cache records are not trusted as provider evidence.
IndexedDB is local browser storage, not encrypted backup or cross-device sync.

## Workspaces and cloud identity

Local workspaces require no account. The existing cloud API enforces server-side
identity, owner checks and expected revisions; incomplete auth configuration must
disable cloud access rather than fabricate a user. Authenticated multi-user and
fresh OAuth acceptance remain unverified in the recovery checkout.

Portable workspace files contain configuration, chart state and referenced Python
source. Import validates a bounded versioned envelope, creates a new workspace and
source IDs, and does not inherit account ownership or execute imported Python.
Backups are plaintext and should be treated as user documents. They do not contain
Helper archives, authentication credentials or a publisher signature. Missing
referenced source is disclosed rather than reconstructed. Cloud workspace
snapshots do not automatically include the local Python draft library.

## Python Helper

The active Python research journey uses the paired local Helper at
`http://127.0.0.1:47321`, not `/api/backtest`. The legacy route is retired.
`research/desktop/server.py` binds loopback, verifies the exact Host, allowed Origin
and loopback client, and requires a paired per-origin Bearer token for protected
operations. Pairing/public discovery have separate checks. A newly chosen preview
port is not implicitly trusted; do not weaken the origin allowlist for a test.

Python strategies are trusted user code. Process-tree limits, timeouts and import
inspection are resource controls, **not a security sandbox**: executed Python can
access local files and the network. Review imported source before running it.
The Helper archive remains on the computer. The unsigned distribution remains an
explicit preview; reproducibility hashes do not establish trusted publisher identity.

## Browser and deployment controls

`next.config.ts` defines response headers and CSP connection destinations, including
public venues and the loopback Helper. Its current script policy permits inline
scripts and eval; it must not be described as a strict nonce-only CSP. Changing
that policy needs Monaco/worker and real research journey verification.

Keep real environment files out of Git. Keep session, database and private provider
secrets in server configuration. Report security issues without including tokens,
source credentials or user archives in logs. Do not weaken auth, origin checks or
process policy to make a test pass.

Before release, verify the exact hosting adapter bundle, protected API behavior,
account isolation, package integrity and the complete browser/Helper journey.
A passing local suite does not certify those external boundaries. Deployment of
the exact candidate still requires user approval; production was not changed by
the audit recovery work.

## Recovery dependency checkpoint — 22 October 2026

The local production dependency audit reports zero critical, high or moderate
findings and two low findings in the Monaco/DOMPurify chain. This is a point-in-time
registry scan, not evidence that the product has no vulnerabilities. Next 16.4.2
and Monaco 0.57.0 are pinned; the Prisma CLI's configuration merge dependency has a
narrow 8.0.0 override, verified through real configuration loading, schema validation,
client generation and disposable SQLite migrations. Recheck that override when
upgrading Prisma. The existing high-severity CI threshold now actually fails on
high/critical findings rather than ignoring the command's exit status.
