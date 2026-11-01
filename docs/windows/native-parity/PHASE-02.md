# Phase 02 — startup and account

28 October 2026. **Local implementation PASS; real service sign-in BLOCKED; additional device configurations NOT TESTED.** The user's subsequent instruction authorizes automatic continuation through phases 03–08, overriding the prompts' default stop-between-phases rule. Publication, vendor contact, purchases and trades remain outside scope.

## Implemented

- Native first-open welcome with approved Logo Kit v1 bytes, centered brand/copy, the two exact actions, blue primary treatment, native caption/drag regions and a readable opaque surface. Mica is optional; high-contrast resource overrides and scroll/width constraints are provided. No wallpaper or taskbar image is embedded.
- Existing Rust Store owns durable onboarding completion. Existing work does not imply completion. Explicit offline choice or a successfully verified/protected account exchange completes onboarding; simply opening a browser does not. Corrupt onboarding values fail visibly and are retained under a recovery key when the user explicitly continues.
- Startup distinguishes loading, welcome, Home and workspace routes. Returning launches show Home. The minimal Home opens real existing local workspace operations and allows account connection; the full gallery/search/card/tab implementation is Phase 03.
- Native identity uses the system browser, an exclusive ephemeral IPv4 loopback listener, independent random state/verifier, S256, strict callback/Host validation, bounded/cancellable requests and Windows Credential Manager. Native operations are serialized, and abandoned grants are revoked or retained as protected pending revocation. Offline work remains independent.
- Local server code reuses verified NextAuth identity and requires explicit request/identity-bound consent. Codes expire at 60 seconds and are atomically consumed. Device credentials are opaque/hash-only server-side, identity-scoped, expire/rotate, detect refresh reuse and support device removal and sign-out everywhere. Browser cookie/Origin requests cannot use the native token boundary. No workspace/provider authority is granted.
- Additive SQLite migration and a transactional PostgreSQL migration candidate with RLS/public-role revocation. The runtime opt-in flag defaults off. No hosted database or public service was changed.
- Default desktop commands now build the WinUI product. Explicit diagnostic and hosted-preview commands retain their separate roles. The build supports an isolated output folder without replacing an already running app.

Source map: `apps/windows-host/winui/MainWindow.account.cpp`, `MainWindow.*`, `App.xaml`, `src/native_account.*`, `src-tauri/workstation-core/src/startup.rs`, `src/lib/native-auth*.ts`, `src/app/api/native/auth/*`, `src/app/native/sign-in/*`, and the additive Prisma changes. No third-party renderer or embedded browser was added.

## Verification

| Check | Result / evidence |
|---|---|
| WinUI native Release build | PASS. Separate output in external `phase02/product/Release`. Build logs and hashes in `verification.json`. The original audit app/output was preserved. |
| Rust repository tests | PASS: 12, including two new first-open/restart/corruption tests. Existing domain missing-documentation warnings remain. |
| Packaged adapter process tests | PASS: eight checks using separate OS processes for first-open, completion, restart, root separation and corrupt-value recovery without changing workspace content. |
| Native account C++ boundary | PASS: 18 checks including the RFC PKCE vector, callback/state/Host/duplicate rejection, real local callback socket, cancellation and Credential Manager storage/root isolation. No external login/browser was used by these fixtures. |
| Native identity/database/HTTP suite | PASS: eight reported tests including the parent; seven substantive subtests use a real isolated SQLite database and actual token/session/revoke route handlers. Tests include consent, wrong verifier/callback, expiry, replay/race, rotation/reuse, owner isolation, all-session revocation, browser credential rejection and body limits. |
| Auth regression | PASS: 26 reported tests including the new suite. |
| TypeScript/lint/schema validation | PASS. SQLite Prisma schema validated; production PostgreSQL execution/permissions remain unverified. |
| Design detector | PASS: no findings on the new browser sign-in component. Native acceptance is separate. |
| Actual native first-open | PASS on this Windows device and isolated Store. The first capture found horizontal clipping; it was corrected with a constrained centered content width and the workspace status bar was removed from welcome/Home. Final evidence: `welcome-product.png` plus keyboard captures. |
| Keyboard offline → Home | PASS: native Tab moves the visible focus ring through account/offline actions; Enter on offline opens Home. Accessibility focus reporting remained on the WinUI root, so screenshots and resulting route/state were used rather than claiming that field was reliable. |
| Process restart → Home | PASS: quit the actual product, verified the previous process exited, launched a new process on the same isolated Store, and captured Home with welcome actions absent. |
| Account service unavailable | PASS, narrowly: actual native availability failure retained the welcome and left zero onboarding-completion rows. This is failure-path evidence, not successful real sign-in. |
| Live account OAuth/exchange | BLOCKED: endpoints, PostgreSQL migration and enable flag have not been published by this work. Real successful/denied/cancelled browser approval, refresh/revocation across the deployed service remain unverified. |
| Additional device cases | NOT TESTED: other Windows user profiles/versions, DPI/text-scaling/high-contrast configurations, monitor changes and real callback ownership under those environments. Source support is not device acceptance. |

The current device is the Phase 01 Windows 11/i5-1335U/Intel UHD machine. No broad startup/frame/origin-traffic performance claim is made. A zero instantaneous TCP count is not a byte/request trace. Existing user storage, workspace records and staged changes were not replaced.

## Evidence and release boundary

External root:

`C:\Users\aykhank\.codex\visualizations\2026\10\28\01a18282-2502-7322-b414-bc1194578ca4\phase02`

It contains the pre-edit manifest, isolated build versions, approved-asset provenance, database/process test logs, native welcome/Home/keyboard/restart PNG/AX captures, and process/module identity. Failed/superseded visual captures remain labelled; they are not the accepted welcome capture. Selected text evidence is copied into `evidence/phase02/`.

Follow `docs/NATIVE_AUTH_EXCHANGE_PLAN.md` before any release: verify the trusted production database role and RLS, apply the reviewed additive migration, publish the bounded identity endpoints via the existing workflow, then enable native auth and perform real service/native acceptance. SQLite fixtures do not validate PostgreSQL concurrency/RLS. No provider SDK, trade, signing credential or public release was used.

Next authorized work: Phase 03 real local dashboard/catalog, workspace lifecycle and native tabs. Live-auth and device gates remain visible while independent phases proceed.
