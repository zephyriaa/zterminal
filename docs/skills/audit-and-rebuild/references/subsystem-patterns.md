# Patterns from the ZTerminal rebuild

Read the relevant section when rebuilding authentication, interactive drawing, or workspace persistence. Re-check the target repository before applying these patterns; the original project used Next.js, Auth.js database sessions, Prisma, Zustand, and lightweight-charts.

## Authentication as a lifecycle

- Separate the verified server session from its client mirror. Seed the client from server rendering to avoid anonymous flashes, and keep one canonical client session source.
- Model initialization, authenticated, anonymous, and unavailable states explicitly. Some auth engines swallow adapter exceptions and return an empty session; observe the adapter at the request boundary so storage outages remain failures.
- Use abort/sequence protection against late refresh responses. Account for browser focus, online recovery, back-forward cache, cross-tab logout, session expiration, and browser restart.
- Bind identity to the provider's immutable subject, with the provider's verified-email contract. Handle email changes without silently merging unrelated identities. Store only the provider credentials the product actually needs.
- Make session deletion idempotent: simultaneous expiry or logout can otherwise turn successful revocation into an exception. Purge account-owned caches only after an established ownership transition, including transitions racing persisted-state hydration.
- Test the actual installed auth protocol: state, PKCE, callback replay, rejected identity, storage outage, and CSRF logout. Local test providers and cookie fixtures must be isolated from production and cleaned up.

## A semantic drawing engine

- Persist time/price anchors and document identity; derive screen coordinates from the native chart adapter. A drawing's scope includes the workspace, pane/document, market identity, and instrument, rather than just a display symbol.
- Use shared projected geometry for rendering and hit testing. Test extrapolated anchors, log/inverted price scales, high DPI, clipping, and replay boundaries. Fib price labels on logarithmic scales must project each price rather than interpolate pixel positions.
- Route pointer gestures through a small controller. Preserve idle native pan/zoom; preview on animation frames, commit once per gesture, and roll back on Escape, cancellation, lost capture, or aborted drag.
- Keep bounded per-document history. Selection and copy/paste must respect locks, visibility, ownership, and document scope; duplicated identifiers must be remapped.
- In multi-pane layouts, controls must mutate the document actually displayed by the focused pane. Header state that updates an unused pane is a subtle source of apparent data loss.
- Validate geometry through browser interactions, not screenshots alone. Include touch, movement outside the chart, native pan/zoom, reload, symbol/timeframe changes, and independent secondary-pane history.

## Workspace and cloud persistence

- Version and validate the semantic snapshot, with explicit size bounds and compatibility for prior readable versions. Do not persist transient pointer or screen-space state.
- Copy drawings into the destination workspace identity when duplicating or restoring a named workspace. Verify reload and source/destination isolation.
- Track ownership for cloud-derived caches; abort pending writes and purge those caches on verified logout/account change while preserving independent local workspaces.
- A debounce queue is not a durable offline queue, and last-write-wins is not conflict resolution. Document these limits unless the requested scope includes durable retry and optimistic concurrency.

## Release evidence

The original Windows host passed the normal application build but failed the Cloudflare adapter's symlink stage. The existing Linux CI pipeline was the appropriate release path. This is a platform-specific example: inspect the actual failure and supported runtime rather than prescribing Linux for every project.

Keep separate evidence for unit/integration checks, browser and visual validation, runtime-specific packaging, successful deployment, and live authentication. None substitutes for another.
