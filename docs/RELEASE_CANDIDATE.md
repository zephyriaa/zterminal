# ZTerminal Recovery Release Candidate

## Candidate scope

This release candidate is the `recovery/canvas-data-foundation` branch. It preserves the deployed Render runtime and Canvas/Focus/Research interaction model while adding truthful market-range semantics, provider/source metadata, browser-local-to-workspace research drafts, shared analytical features, and a deterministic research-only evaluation slice.

## Verified local gates

| Gate | Result |
|---|---|
| Type check | Passed with `pnpm check` |
| Unit suite | Passed: 8 files, 20 tests |
| Production build | Passed with `pnpm build` and no unresolved analytics-placeholder warning |
| Live public-provider smoke path | Passed locally: Gate.io QQQX/USDT snapshot plus a verified 97-bar, 15-minute one-day range |
| Browser data contract | Passed: symbol, requested range, effective coverage, source, feature version, and dataset fingerprint were visible |
| Research draft boundary | Passed: unauthenticated draft remained browser-local and the protected server route returned HTTP 401 without a server stack |
| Research evaluation | Passed: same verified data window ran under next-bar-open model with explicit defaults and no-advice limitations |

## Required deployment steps

| Order | Action | Verification | Rollback |
|---|---|---|---|
| 1 | Configure a non-empty `DATABASE_URL` for the deployment environment if durable authenticated workspaces are to be enabled. | Database connectivity is available to the existing OAuth user-sync path. | Do not run the migration; the product remains chart/research-local only. |
| 2 | Review and apply `drizzle/0001_narrow_harry_osborn.sql` exactly once against the target database. | `workspaces` and `researchDrafts` exist with their foreign keys and indexes. | Restore database from the pre-migration backup; application route remains protected and fails explicitly if storage is unavailable. |
| 3 | Confirm production environment values for `JWT_SECRET`, `OAUTH_SERVER_URL`, and the existing OAuth application settings. | Existing sign-in works; authenticated `research.listDrafts` resolves without a 401. | Disable workspace UI access and retain browser-local drafts until OAuth/database configuration is corrected. |
| 4 | Deploy the branch through the existing Render service configuration. | `/healthz` responds; a public snapshot, bounded historical range, and unavailable capability states are truthful. | Redeploy the recorded baseline `render-hosted-research-terminal` commit `ddf9bd9350a006c885579004351bc37e2b73ee33`. |
| 5 | Execute the production smoke checklist below. | All required checks pass before public announcement. | Halt rollout and use the baseline rollback reference. |

## Production smoke checklist

The release owner should verify the following from a clean, unauthenticated browser and then an authenticated browser.

1. The initial Canvas connects to a public Gate.io snapshot or displays the defined unavailable state without stale values.
2. Changing the symbol issues a provider-validated request and never silently substitutes an instrument.
3. Selecting `1D`, `5D`, `1M`, `3M`, `6M`, `YTD`, `1Y`, or `MAX` displays the requested selection and the effective UTC coverage. `MAX` must remain visibly bounded rather than implying all available history.
4. VWAP, EMA, profile, and structure display their loaded-window source, feature version, and dataset fingerprint. CVD and GEX remain unavailable until their declared data requirements are met.
5. An unauthenticated research draft is labelled local-only. An authenticated draft is saved only after the configured database migration is complete.
6. The evaluation panel runs only from a verified loaded dataset, reports its run hash and limitations, and states that it is research-only with no broker route or investment-advice claim.
7. Unauthenticated protected research calls return HTTP 401 with no stack trace or local path in the response.

## Known controlled limitations

The candidate does not claim durable workspace persistence until a deployment database is configured and the additive migration has been applied. It does not implement CVD, GEX, tick-level volume-at-price, alerts, account aggregation, broker execution, scenario optimization, short strategies, limit/stop fills, parameter sweeps, or walk-forward validation. These remain explicitly unavailable or future work rather than implied capability.


## Dependency security gate

The production dependency audit was rerun after targeted compatible updates and lockfile overrides. The final audit reported **0 critical** and **0 high** findings, with 26 moderate and 7 low findings remaining for routine dependency maintenance.

| Remediation | Applied control |
|---|---|
| XML parser entity-encoding bypass | Pinned transitive `fast-xml-parser` to `5.3.5`. |
| HTTP/provider paths | Updated `axios` to `1.19.0` and AWS S3 clients to `3.1112.0`. |
| RPC prototype-pollution advisory | Updated all direct tRPC packages to `11.18.0`. |
| ORM identifier-escaping advisory | Updated `drizzle-orm` to `0.45.2`. |
| ID generator advisory | Updated `nanoid` to `5.1.16`. |
| Express routing and UI-library transitives | Added patched `path-to-regexp`, `lodash`, and `lodash-es` lockfile overrides. |

The post-update branch passed type checking, all 20 unit tests, and the production build. The package manager still reports an existing Vite peer-range warning from `@builder.io/vite-plugin-jsx-loc`, plus deprecated but non-high/critical transitive packages; neither was changed in this controlled P0/P1 slice.
