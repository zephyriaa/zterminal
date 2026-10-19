# Phase 05 — local repairs verified; full acceptance BLOCKED

19 October 2026. Automatic independent local continuation is authorized by the user's updated instruction. No deployment, package publication, production configuration change, staging or commit occurred. Phase 06 is next for independent supervision checks; prior browser/release gates remain open.

## Revalidation and smallest repair

- Public HTTP still returns 404 for `/vendor/monaco-0.55.1/vs/loader.js`. The release endpoint offers preview.4 without the current research capabilities. This is deployed evidence, separate from local work.
- Retained the current immediate textarea, ten-second enhanced-editor timeout, chunk error boundary and durable-write-before-reload behavior. Added the missing Ctrl/Cmd+Enter Run shortcut beside its existing Save shortcut. No editor rewrite or new dependency.
- `build:production` lacked Monaco preparation on a clean checkout. Added the existing `prepare-monaco.mjs` step; regular build/prebuild and Cloudflare's buildCommand already prepare assets. Existing pin 0.55.1, local worker/CSP policy and verifier were retained.
- One capability predicate is shared by current connection/run readiness and current release/download resolution: protocol 1, research schema 2, `synthetic_next_open_v2` and `research_analyses_v1`. Compatibility is capability-based, not version-string ordering. Incompatible configured downloads now return actionable 503 without redirect. The workbench explains this prerequisite before Run.
- Legacy manifest resolution remains available to existing callers; new Helper runtime still supports schemas 1 and 2. No archive or package migration/removal occurred. The existing error for invalid/expired connection codes and network permission denial was preserved.

## Evidence and checks

- `evidence/tests-final.log`: 245 TypeScript tests passed, zero failed. New regression initially failed before implementation. Release route tests verify legacy incompatibility, current compatibility, trust-boundary rejection, matching metadata/redirect status and no-store failures.
- TypeScript noEmit and scoped lint passed; final candidate build performs its own type check. Scoped whitespace check passed. Whole-tree whitespace check still reports a pre-existing blank line in `research/desktop/server.py`; it was preserved.
- `evidence/preservation.json`: index unchanged; all 1,666 non-runtime baseline files checked, no unexpected changes, original audit/prior phases preserved. Pinned runtime used with bytecode disabled; no dependency generation/install in the original checkout. Source changes are precisely recorded in `phase05.patch` and `before/`.
- `evidence/package-runtime-pinned.log`: actual retained packaged interpreter/service passed pairing, code reuse/rotation, port conflict, legacy/indicator/schema-v2 execution, analyses, cancellation, immutable archive and launcher pipe-loss cleanup. Disposable data only, no personal service or archives. The first host-interpreter attempt failed because its test environment lacked NumPy; the pinned-runtime invocation corrected that test prerequisite.
- `evidence/package-probe.json`: independently observed packaged capabilities and exact allowed Origin, unrelated Origin 403, invalid code 403, launcher and interpreter x64 PE identities. HTTP Origin checks are not browser HTTPS/local-network permission proof. Actual ten-minute expiry was NOT RUN in Phase 05.
- `evidence/package-identity.json`: retained preview 1.1.0-preview.1 ZIP, 201,500,827 bytes, SHA-256 `13a65d1255ab11539ab5df9cb32a28341c58c3a4026ec251333e420221bb5a74`; 31,542 ZIP/extracted member SHA-256 comparisons pass. All ten packaged application sources match current source. Existing correct package reused rather than rebuilt. This is a retained local ZIP, not a new hosted download or installation test.
- `candidate-helper.json` ties capabilities to that local ZIP. `download_url` is intentionally null: this is review metadata, not a deployable production release manifest. A reviewed authorized hosting URL and exact release approval remain required.
- REA observed the published preview.4 ZIP root hash; its deeper inspection failed with an overlapping-entry error. That tool failure is retained and is not a claim that every member is corrupt. Read-only member inspection established absence of feature advertisement; that old package was not executed in this phase. REA session closed.

## Candidate build gate

An isolated source/dependency copy at `candidate-web/` preserves the original `.next`, `.open-next`, generated Prisma client and public assets. The first production build compiled and type-checked, then failed page collection: PostgreSQL client generation combined with an omitted DATABASE_URL selected the SQLite initialization path. No application database code was changed for this configuration prerequisite.

Configured retry uses an explicitly unreachable fixture PostgreSQL URL (`127.0.0.1:1`) with no production credentials. The final outcome, assembled standalone asset serving and Cloudflare adapter status are recorded in `evidence/build-results.json`. Do not infer success from the source `public/` tree or an unfinished build. Database connectivity and authenticated journeys are unverified.

The first configured copy inferred the outer checkout as its workspace root and assembled a nested standalone entry. The isolated harness then set `outputFileTracingRoot` and `turbopack.root` to its own working directory; the repository config was untouched. That build passed; its actual standalone server served all 121 pinned Monaco assets and the license with matching bytes, and both unconfigured download/metadata endpoints returned no-store 503. The owned server was stopped. Two generated CSS optimization warnings were retained for the later visual/performance review. They were not suppressed. Authentication startup warnings are expected with the explicitly omitted credentials and do not certify auth behavior.

Actual OpenNext Cloudflare assembly reused the completed PostgreSQL Next build through its supported `--skipNextBuild` option. It reached static/cache bundling, then failed `EPERM` creating a dependency symlink during server-function tracing. The emitted `.open-next/assets` contain all 121 exact pinned assets and license, but this is partial output, not a deployable verified Worker. No permission escalation, dependency patch or unsupported-version override was used. A supported build environment permitting the required symlinks is an open Phase 18 prerequisite. The regular local/SQLite build is checked separately.

The attempt to preserve the generated PostgreSQL standalone folder by renaming it *inside* `.next` did not survive Next's subsequent output cleanup. Production serving/build evidence remains in the logs and JSON observations, but that generated bundle is not retained as a release candidate. The original checkout's build directories were never used. Final local output will be retained outside the candidate's `.next`; Phase 18 must create and verify a fresh exact production candidate.

The regular `npm run build` completed successfully, including SQLite Prisma generation, fresh Monaco preparation, Next compilation/typechecking/page generation and verification of all 121 assembled assets plus license. Its completed standalone output is retained at `candidate-standalone-local/`, outside `.next`. `evidence/candidate-source-identity.json` binds all nine final Phase 05 source files, dependency lock, local build ID and standalone entry hash. This local/SQLite output is not a reviewed production/Worker release candidate.

## Open gates and continuation

Browser Harness doctor reports no supported running browser, daemon or active connections. No alternate driver or rejected launch was retried. Therefore actual template selection, typing/save/reload, late enhancement retaining fallback edits, blocked loader/chunk/worker recovery, diagnostics, focus/shortcuts, installation/discovery and HTTPS-to-loopback permissions remain unverified. Historical A141/A142 PASS safeguards are retained with this explicit scope; they are not renewed browser PASS claims.

F02 and F11 remain unresolved. A132/A147 are PARTIAL; A245 has local route regression evidence. All 252 original rows and their original observations remain in the new ledger. Deployment still has the loader failure and old offered package. A local capability guard contains incompatibility but does not deliver a newly published runtime.

Next: `prompts/06-helper-runtime-and-jobs.md`. Re-read this handoff and repair ledger. Preserve Phase 05 evidence and do not treat its browser/release blockers as complete. Continue independently testable supervision work under the user's automatic continuation instruction. Phase 19 still requires exact-candidate/target authorization.

Any later Helper source change invalidates this retained package's source match for a new candidate. Rebuild/reverify before the integrated Phase 18 release review.
