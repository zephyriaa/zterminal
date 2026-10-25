# Worker request lifetime continuation — 25 October 2026

PR #16 deployed merge `e4233ab1d37f8bea9a15b9c1f86e4d1cc40ed741` after
the candidate and merged Linux quality workflows passed, including Cloudflare
assembly, workerd smoke and the unchanged production audit gate. The live
Python Strategy panel loads the patched Monaco assets and tokenizes Python.

## Authenticated runtime failure

Deployed acceptance encountered an initial workspace HTTP 500 / Cloudflare 1101
that cleared on reload. Subsequent authenticated cloud-list requests reproduced
HTTP 500, 200, 500. Worker tail captured the runtime's hung-request exception for
`/api/cloud/workspaces`; passing anonymous workerd smoke had not exercised this
authenticated database path. Existing-session recovery is not fresh OAuth proof.

The PostgreSQL Prisma client previously lived at module scope in Workers,
retaining its driver connection pool between requests. Worker sockets belong to
the request that created them. `db.ts` now lazily creates one client for each
OpenNext request context and schedules disconnect with Next's `after`. The
shared `db` interface, transactions and the native Node/SQLite singleton remain.
No connection string, auth cookie, token or private pairing value is recorded.

The regression executes the actual database module with substituted runtime
dependencies. The previous implementation fails; the candidate checks lazy
allocation, reuse within one request, isolation between requests, bound Prisma
methods and independent cleanup. All 370 Node tests, typecheck and focused lint
pass locally. Full lint found a test-variable naming violation, which was fixed;
the earlier full run's pre-existing unused-directive warnings were retained.
Authenticated deployed requests must pass after this candidate is published;
the regression alone cannot establish runtime acceptance.

## Public-feed verifier

Fresh captures reached the book comparison, but the verifier's observation time
included only trades. Later depth was correctly withheld as future data by the
context model. The captured final depth followed the last trade by 2,064 ms on
Gate and 202 ms on Binance. Include both accepted depth and trade timestamps in
the verifier's observation time; product timestamp guards are unchanged.

The corrected Binance live check passed (93 trades / 3,990 frames). The first
corrected Gate retry failed to reconstruct a ready book; that run is not a pass.
A subsequent Gate live capture passed (328 trades / 1,656 frames). These are
bounded observations, not continuous uptime or browser reconciliation proof.

## Local report roundtrip

The actual local browser ran the educational moving-average strategy through the
installed packaged Helper using a disposable archive. The report retained 929
closed candles, including pre-roll, for a 30-day requested window with a reserved
holdout. Its 395,467-byte browser download exactly matched the archived envelope.
After a browser reload and Helper restart into a second empty archive, the real
download was imported through the report file input and reopened. Its complete
envelope and result hash matched; the restored archive contained zero jobs.
This was not a full browser-process restart, deployed Helper acceptance or a
fresh OAuth/two-account isolation check. The user's research archive was unused.

Evidence is under ignored `artifacts/helper-redesign/resume-worker-*`,
`resume-production-cloud-before.log`, `resume-report-*` and
`artifacts/feed-reconciliation/`. Signing, native Install-button relaunch,
elapsed expiry, long-run reliability and two-account OAuth remain open.

## References

- [Prisma Workers connection-lifetime guidance](https://www.prisma.io/docs/guides/deployment/cloudflare-workers#common-gotchas)
- [Next after lifecycle](https://nextjs.org/docs/app/api-reference/functions/after)
- Installed Next documentation: `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md`.
