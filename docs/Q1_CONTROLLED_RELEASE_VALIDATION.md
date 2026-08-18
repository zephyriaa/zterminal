# Q1 Controlled Release Validation

**Scope:** recovery branch only. This record verifies the release candidate locally and in the canonical recovery repository. It does **not** merge, deploy, or promote the recovery branch to the production Render service.

## Automated Quality Gate

The GitHub workflow at [`.github/workflows/quality.yml`](../.github/workflows/quality.yml) reproduces the following CI sequence on pushes to the recovery and production branches and on pull requests: frozen audited install with lifecycle scripts disabled, TypeScript check, regression tests, production build, and a dependency audit that rejects high or critical findings.

| Gate | Local result |
|---|---|
| `pnpm install --frozen-lockfile --ignore-scripts` | Passed |
| `pnpm check` | Passed |
| `pnpm test` | Passed: 18 files, 55 tests |
| `pnpm build` | Passed with Vite 7.3.6; browser worker bundle emitted |
| `pnpm audit --audit-level=high` | Passed; audit reports 8 low and 27 moderate findings, with 0 high and 0 critical |

## Production-Built Local Smoke

The built server was started at `NODE_ENV=production PORT=3012 pnpm start` and tested directly. The app served static content successfully and the public market readiness probe reached Gate.io.

| Check | Observed result |
|---|---|
| `GET /healthz` | `200` with `status: ok` and `execution: disabled` |
| `GET /readyz` | `200` with `status: ready`; dependency `public-market-snapshot`; provider `gateio`; symbol `QQQX_USDT` |
| `GET /` | `200` |
| Response security headers | `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: no-referrer`, `Permissions-Policy: geolocation=(), microphone=(), camera=()` |
| OAuth startup state | Expected configuration warning: `OAUTH_SERVER_URL` is unset; this confirms OAuth remains unavailable rather than falsely enabled |

## Release Boundary

> The production branch remains at its prior Render deployment. The recovery branch has not been promoted. A future production release requires a review of this evidence, confirmation of Render environment configuration (especially the explicitly unavailable database/OAuth/JWT/storage paths), a user-approved pull request, and a post-deploy smoke against the Render URL.

Q1 is complete on the recovery branch pending commit. Browser-level verification already covers the premium workstation, live/public data states, protocol drawer, closed compiler, B1 evidence worker, command palette, and strict Focus Mode. This record adds CI-equivalent and production-built HTTP smoke proof without changing production.
