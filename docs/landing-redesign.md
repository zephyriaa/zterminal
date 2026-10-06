# ZTerminal landing redesign

Implemented on 6 October 2026. The latest direction preserves the centered hero, real workspace, research narrative and section layout, while adding a more substantial visual atmosphere.

## Audit and implementation

The previous landing combined a large client component, laptop presentation, motion wrappers and repeated product sections. The replacement renders the narrative and imagery on the server. Small client components own only the hero lighting and desktop research presentation. No dependencies were added.

The first replacement was too flat: a nearly uniform background, weak surface separation and barely visible motion made the workspace feel detached. The final pass adds a graphite backdrop with static material grain, a directional violet beam, a curved light horizon, recessed screen edges and stronger shadows. The hero has finite, staggered entrances. Fine-pointer movement and scrolling adjust the light position without moving the document or distorting the product. Updates are coalesced into animation frames, gated by visibility and motion preferences, and listeners are cleaned up on unmount.

The hero atmosphere originally ended 170px above the section bottom (180px on mobile), cutting its grain and lighting into a visible horizontal band through the proposition. It now covers the entire hero and fades through a 320px mask (240px on mobile). The research wash also fades at its edges. These changes preserve the layout and remove the abrupt background boundaries.

Hero entrances are enabled only when opening at the top without a fragment. Direct section links and restored scroll positions use the static composition, preventing an offscreen entrance from disturbing browser anchor restoration. The browser check waits for fonts and the anchor's declared scroll margin, then verifies that the linked heading remains visible below navigation after reload. It does not require identical absolute pixels while the browser restores font and image geometry.

The desktop research sequence uses a sticky product stage, an active chapter rail, and a short focus/scale transition. Intersection observers select chapters in both scroll directions. At narrower widths, shorter viewports, reduced motion, or without JavaScript, all chapters and their images remain in sequential document flow. Content never depends on a reveal animation.

Shared navigation receives landing-scoped styling and a compact account entry when used in hero mode. Documentation, research, download, account and terminal routes retain their existing implementations. Windows availability comes from the release-status route rather than an invented download link.

## Product imagery provenance

The new `public/landing/research-*.webp` files are resized/cropped captures of the real local application, not generated UI. Each filename includes the first eight SHA-256 characters to avoid serving stale image-optimizer results after replacing an asset.

The capture used a fresh browser context and a dedicated Helper archive at `artifacts/landing-redesign/helper`. It did not change the user's saved layouts, drawings or normal research archive. The task-owned Helper was stopped after capture.

The actual educational moving-average example used EMA 9/21, 2,160 closed hourly BTC/USDT perpetual observations from Gate.io, 90 days of data, initial quote cash 10,000, allocation 10%, fee 10 bps and slippage 5 bps. The long-only historical run produced 49 closed trades. Performance figures in the screenshots came from this run; they were not fabricated. CAGR is unavailable for this short range. Monte Carlo is described as an existing analysis capability, but no Monte Carlo result was fabricated for the capture.

The workspace and strategy captures show the connected local Helper and actual Python source. The assumptions capture shows costs and sizing. The report capture shows the real result; the provenance capture shows archived hashes and versions. Small screens use deliberate crops of those same captures. The market and report views share a source capture. Original full-resolution captures and run data are in the ignored `artifacts/landing-redesign` folder.

AI media tools were investigated for a supporting background, but no generated asset was required in the final implementation. Fal rejected generation because the connected account had no balance; no purchase or trial was initiated. The lighting is implemented directly in CSS.

## Validation and release boundaries

The full repository test suite passed during the rebuild (201 tests). Focused brand checks and lint passed after the atmosphere changes. The normal Next.js production build, including TypeScript and static generation, passed after the final asset URLs were updated. The prebuild Prisma generation hit a Windows DLL lock from the existing development server; its existing fallback used the already generated client and the actual application build completed successfully.

`npm run test:landing` checks eight widths (360, 390, 430, 768, 1024, 1280, 1440, 1920), overflow, images, navigation dismissal/focus, forward and reverse workflow scrolling, resizing, live reduced-motion changes, restored anchors, keyboard skip navigation, no-JavaScript content, browser errors and public routes. Screenshots and results are written under `artifacts/landing-redesign/production-qa` for the production preview.

The final production-browser run passed all of those journeys. No horizontal overflow, broken images or browser errors were observed. Journey layout-shift totals, including responsive/motion changes and anchor restoration, stayed below 0.1 (maximum 0.0552). Reduced-motion lighting is enforced by CSS as well as the JavaScript preference gate, so late media-query event delivery cannot leave the scene moving.

`scripts/measure-landing-performance.cjs` records cold-browser loading and layout stability with Chromium on Windows, CPU throttling at 4x, 4 Mbps down / 1 Mbps up and 40 ms added latency. The baseline is the remote Cloudflare site and the candidate is local Node standalone: timing differences cannot be attributed solely to the redesign. These are individual lab samples, not field Core Web Vitals or production p75 measurements. Results live under `artifacts/landing-redesign/performance`.

The final atmosphere pass was measured with `node scripts/measure-landing-performance.cjs --candidate-only`. At 390px, LCP was 984ms, CLS 0 and transferred resources approximately 396KB. At 1440px, LCP was 1048ms, CLS 0 and resources approximately 539KB. Encoded JavaScript was approximately 172KB in both runs. The initial remote baseline was approximately 2.06MB of transferred resources and 228KB of JavaScript; server and caching differences limit that comparison.

The local production preview does not have the production Google OAuth/PostgreSQL configuration. Account entry is checked, but a granted OAuth callback is not verified. No deployment was requested or performed. The Cloudflare adapter build and a live post-deployment smoke test remain release requirements.
