# Authentication and drawing rebuild — 2026-10-06

Implemented and verified locally in the existing Next.js terminal. No deployment or real Google consent/account login was performed. The audit started with Next.js 16.3.5 and patched it to 16.3.6; NextAuth 4.24.11, Prisma 6.19.3, and lightweight-charts 5.2.1 were retained. The installed Next.js authentication and Route Handler guides were read before implementation and checked again after the patch.

## 1. Authentication root causes

The September production audit described missing configuration; that observation is historical. On October 5, the existing Worker advertised Google correctly and generated the correct Google authorization URL. The current repository still had several reproducible reliability gaps: Auth.js v4 converted adapter failures into successful empty session responses; the UI could confuse those failures with logout; concurrent expired-session observers could attempt the same non-idempotent deletion; callback failures did not return through a consistently useful terminal recovery UI; and runtime configuration accepted malformed development origins and unnecessarily persisted provider credentials.

The audit did not prove the cause of every reported real Google login failure. The production authorization handshake was exercised, but Google consent and the granted callback were not. A missing secret is no longer an evidence-backed explanation for the current deployed symptom.

## 2. Authentication before and after

The retained backend is Google OAuth → Auth.js → Prisma User/Account → revocable database Session → HttpOnly cookie. Account(provider, providerAccountId) has a unique constraint and User.id owns cloud data. Supabase is a possible PostgreSQL host, not a second authentication provider. No password provider or secure native browser-login bridge exists.

Previously the client used the stock SessionProvider without a distinct verifier-unavailable state. It now has one server-session mirror, seeded by SSR, that supplies the existing Auth.js SessionContext to every useSession consumer. It distinguishes initializing, authenticated, anonymous, and error states, validates the identity DTO, aborts superseded fetches, and refreshes on mount, focus, visibility, online recovery, BFCache restoration, tab messages, expiry, and a five-minute visible/online poll. The database session remains the authority. Account caches and drawing caches are scoped to the verified user; verifier outages suspend cloud writes without impersonating logout.

Google sign-in uses the existing same-tab redirect flow. Google creates or reuses the immutable provider identity; verified email changes update that user's profile without merging another user by email. Google API-token expiry is separate from ZTerminal database-session expiry. A popup-close scenario does not apply to this flow. Native sign-in is specified in [the exchange plan](NATIVE_AUTH_EXCHANGE_PLAN.md), without exposing a fake working login button.

## 3. Security changes

State and S256 PKCE are explicit. Redirects are restricted to the configured origin and reject credential-bearing and scheme-relative external destinations. Profile and workspace mutations require a matching Origin and reject cross-site fetch metadata. No permissive CORS was added. Production requires HTTPS, PostgreSQL, complete Google configuration, and a secret of at least 32 characters. NEXTAUTH_SECRET accepts AUTH_SECRET as an alias and retains JWT_SECRET as a legacy fallback. Development HTTP is limited to loopback origins.

The adapter keeps provider identity fields and drops Google access, refresh, and ID tokens. [The one-time cleanup SQL](../prisma/auth-token-minimization.sql) removes old stored Google tokens without deleting identities or sessions; it has not been applied to production. Session deletion is idempotent across tabs/SSR/API requests. Session-verification outages return 503, and profile/cloud errors expose safe messages. Auth.js logs diagnostic codes only; local Prisma logs omit raw invocation and connection details. Tokens are absent from browser storage and committed environment files; only .env.example is tracked. Existing session cookies remain HttpOnly, host-scoped, Lax, and Secure under HTTPS; auth/private responses are no-store.

The registry audit found [GHSA-vcvr-r3jv-pc5j](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j) in the installed Next.js version. Next and its lint configuration are pinned to the patched 16.3.6 release. No next/og ImageResponse usage was found in src; this is a dependency fix rather than a claim that an exposed exploit was reproduced. The production dependency audit changed from 1 critical / 6 high / 4 moderate to 0 critical / 6 high / 4 moderate. Remaining advisories include Prisma configuration/deepmerge-ts, brace-expansion, Engine.IO, undici, Monaco/DOMPurify, and Worker build tooling; they still require dependency remediation and do not justify a clean security bill.

## 4. Drawing architecture before and after

The chart library and existing ChartDocument remain canonical. Drawings are semantic timestamp/price objects in document schema 5 and drawing schema 1. The additive tool/style changes preserve older objects through validated migration. Document keys include workspace, chart, provider, exchange, product, and instrument; timeframe is a view/visibility property rather than a second coordinate authority.

Previously a DOM input overlay intercepted ordinary chart navigation, creation was largely drag-only, cancellation could commit, ray geometry and hit testing differed, snapping used a percentage-price heuristic and could see replay-hidden bars, and named/cloud snapshots omitted drawings. Secondary panes lacked the drawing workflow.

Now shared timestamp↔logical-index interpolation/extrapolation and native series price conversions drive geometry. A native series primitive renders and hit-tests cached projected geometry, including directed/clipped lines and market-projected Fibonacci prices. The pointer controller separates creation, anchor/whole-object editing, preview, cancellation, and committed changes. rAF updates the primitive preview; pointer pixels do not persist or rerender the chart tree. The document store owns bounded per-document drawing history. Serialization validates ownership and remaps snapshot workspace IDs. Each secondary pane owns its document, tool, selection, and history.

## 5. Toolkit

All 22 types are integrated: trend line, ray, extended line, horizontal line, horizontal ray, vertical line, cross line; parallel channel; Fibonacci retracement and extension; rectangle, ellipse, polyline, arrow, text, callout, price label; price range, date range, combined ruler, long position, and short position.

## 6. Repaired interactions

Creation supports click sequences, two-anchor drag creation, three-anchor tools, polyline Enter/double-click finish, mouse/touch taps, live preview, persistent tools, and Escape/right-click/pointer-cancel rollback. Selection follows z-order and prioritizes selected handles. Whole-object dragging preserves offsets; anchors and position stops can be edited; pointer capture continues beyond chart bounds. Empty chart space and scales retain native navigation.

Weak magnet uses a 12 CSS-pixel tolerance; strong magnet chooses nearby available-bar OHLC values. Replay passes only available bars to snapping and hides drawings whose anchors are in the future. Context commands, object list, lock/hide, duplicate, delete, copy/paste, undo/redo, and clear are integrated. Dragging creates one history entry. Keyboard handlers respect editors, inputs, dialogs, and secondary chart ownership. Settings cover line/fill colors, width, style, opacity, extensions, text size/weight/alignment, custom Fibonacci ratios/labels, and position inputs. Toolbar flyouts were repaired for overflow and CSS specificity.

Named workspaces include validated chart documents, can be loaded through Ctrl/Cmd+K, and keep edits isolated from their source. Cloud payload version 2 includes the same documents; version 1 metadata remains readable. Drawing changes update named local snapshots and use separate debounced cloud queues per workspace. Pending writes survive a verifier interruption within the mounted app and retry on online recovery. Cached cloud documents carry owner metadata and are purged on logout/account change, including delayed hydration. A newer restored revision discards obsolete undo history.

## 7. Significant modules

Auth: lib/auth*, lib/db.ts, server/auth-session.ts, auth/profile/workspace routes, terminal/page.tsx, components/auth/session-provider.tsx and cloud-sync-bridge.tsx, account-panel.tsx, and the terminal account header.

Drawings: lib/chart/contracts.ts, drawings/{contracts,coordinates,geometry,snapping,primitive}, lightweight-adapter.ts, workspace-snapshot.ts, workspace-payload.ts, stores/{chart-documents,workspace}, terminal-chart.tsx, drawing interaction/toolbar/inspector/object-list components, secondary-drawing-chart.tsx, multi-chart-grid.tsx, reference-chart-workspace.tsx, command-palette.tsx, and drawing CSS. Existing unrelated working-tree changes were preserved.

## 8. Coverage added

auth-lifecycle.test.ts covers configuration, redirect/origin policy, DTO validation, availability probes, immutable identity, token minimization, and revocation. auth-protocol.test.ts exercises the installed Auth.js engine with an ephemeral OAuth provider, real Prisma records, state/PKCE, blocked-cookie callbacks, first/returning identity, verified email changes, email collisions, callback replay, provider cancellation, session restore, concurrent expiry, and CSRF-protected logout. drawing-engine.test.ts covers transformations, geometry/hits, z-order, snapping, serialization, history, snapshot restoration, account cache boundaries, and 1,000-drawing hit-test cost. Existing auth tests were extended.

scripts/test-auth-browser.ts exercises the actual local server with temporary, cleaned-up database sessions; credentials and retained browser-cookie fixtures stay in memory. scripts/test-drawing-browser.cjs uses deterministic intercepted candles and real native canvas/pointer/UI behavior at DPR 1 and 2.

## 9. Remaining limitations and release gates

Real first/returning Google consent, the granted production callback, production PostgreSQL behavior, Google-console publication/test-user restrictions, and the future custom-domain migration require deployment/account validation. No live secrets, Google-console settings, or databases were changed. A domain change requires registering its exact Google callback and public origin; host cookies intentionally do not migrate between domains. Complete cookie blocking cannot support login, and produces a recoverable verification error.

Windows exchange endpoints, OS credential storage, and device sessions remain unimplemented. Cloud saves still use last-writer-wins; there is no server revision conflict resolution or durable upload queue across browser restarts. Unuploaded semantic changes remain in device documents, but reconnecting after a restart may require another edit/save to upload them. Undo history is bounded at 100 operations and intentionally not persisted across reload. Snapshot import is bounded at 32 chart documents. Per-Fibonacci-level color/style controls, advanced visibility UI, favorites, and a full regression-channel tool remain future work. Many-drawing cost was measured for hit testing and a synthetic headless browser edit; sustained full-render FPS on ordinary physical laptops was not benchmarked. Touch creation was exercised in Chromium emulation; physical touch hardware and other browsers remain unverified.

The Worker build generated the PostgreSQL client and completed its Next.js compile/typecheck/page generation, then failed during OpenNext bundle copying with Windows EPERM on a Prisma symlink. OpenNext explicitly warns about native Windows compatibility; WSL is not installed here. The Worker bundle is therefore unverified and must pass the existing Linux CI before deployment. No unsupported-build override or system-permission change was used. The SQLite development client was restored after this build attempt.

## 10. Recommended next drawing work

Add a regression channel with explicit sample-window semantics, per-level Fibonacci controls/fill bands, anchored VWAP, saved tool presets/favorites, and then server revision/conflict handling. Prioritize those over expanding the toolbar with unimplemented names.

## 11. Existing architecture debt

The contract catalogue can report BINANCE as a static exchange while the active feed is Gate.io, and chart seeds currently label instruments perpetual even for non-perpetual catalogue symbols. A deliberate instrument-identity migration is needed before changing document keys. Multi-chart symbol/timeframe header actions and crosshair/symbol synchronization have existing primary-pane inconsistencies; secondary symbol isolation is verified here. Indicators share a global studies store while drawings are now pane-owned. CSP still permits unsafe-inline/unsafe-eval for existing application code; this change does not claim a complete XSS-hardening exercise. The tracked db/custom.db fixture currently contains zero users/accounts/sessions, but tracking a future populated per-machine auth database would be unsafe; development setup should continue to exclude private databases. Dependency and deployment quality gates must be assessed separately from unit-test success.

## 12. Validation evidence

Baseline: 183 unit tests and typecheck passed before changes. Final local suite: 201 tests pass, with no skipped tests. Typecheck passes. Repository lint passes with 11 pre-existing unused-disable warnings and no errors. The production Next build passes. Browser auth, drawing DPR 1/2, and the existing terminal regression at 1440×900, 768×1024, and 390×844 pass. Screenshots were inspected for the drawing canvas and multi-chart layout. Browser drawing tests create every type and check mouse/touch creation, editing, history, context duplication, cancellation, out-of-bounds capture, pan/zoom, resizing, timeframe, logarithmic/inverted scales, replay-safe strong magnet, named workspace persistence/isolation, secondary history/symbol changes, backing-canvas DPI, and uncaught errors. Auth browser coverage includes SSR without anonymous flicker, reload/back/new-tab/browser restart, stale slow reply, verifier failure/retry, multi-tab logout/revocation, expiry/invalid cookie, callback recovery, cloud snapshot round-trip, Origin rejection, and owner-cache purge.

The DPR 1 synthetic browser sample loaded 1,000 semantic drawings, created/dragged one additional line, and undid the drag as one operation. Over 60 sampled frames, median frame time was 16.7 ms and the 95th percentile was 33.4 ms. This is a short headless lab observation, not a physical-device performance guarantee. Thin-ellipse phantom-hit cases also have explicit geometry regressions.

The existing production Worker returned enabled:true, Google providers, anonymous session {}, and private no-store headers on October 5. Its authorization URL targeted accounts.google.com with the exact workers.dev callback, state, and PKCE S256. OAuth handshake cookies were HttpOnly/Secure/Lax. A cancelled callback redirected to its error route. This validates initiation/cancellation, not a granted Google login and not the new code in production. Local evidence is under artifacts/drawings, including unit-tests.txt, auth-browser.txt, browser-summary.json, production-auth-handshake.json, build.txt, cloudflare-build.txt, dependency-audit-after.json, and DPR screenshots. Artifacts contain no live credential values.

Reproduce the standard checks with npm test, npm run typecheck, npm run lint, and npm run build. With the development server running, node scripts/test-drawing-browser.cjs and npm run test:terminal exercise the UI. The auth browser script additionally requires a localhost server started with process-local test-only Google client/secret values, NEXTAUTH_SECRET, and NEXTAUTH_URL=http://localhost:3000; then run npx tsx scripts/test-auth-browser.ts. These are fixture settings, never production settings. The script refuses non-localhost origins and cleans up its database records. Use the normal development environment again after fixture verification.

## 13. Commits

Local checkpoints are on codex/auth-drawing-rebuild:

- 048fc78 — fix(auth): stabilize Google OAuth and session lifecycle
- 2665a77 — feat(chart): rebuild drawing interactions and workspace persistence

Git initially had no configured author. These checkpoints use the explicitly labeled Codex Agent <codex-agent@localhost> identity through per-command settings; personal Git configuration was not changed. Unrelated pre-existing edits have not been staged. No push or deployment was performed.
