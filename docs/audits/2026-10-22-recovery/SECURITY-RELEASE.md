# Security release continuation — 25 October 2026

The recovery branch previously failed its production dependency gate. The fresh
audit identified Monaco's embedded DOMPurify and additional advisories affecting
Zod, body-parser and Undici. The audit threshold is unchanged.

## Repair

Monaco remains pinned to 0.57.0. Its module sources are bundled with the existing
esbuild toolchain, resolving the vendored DOMPurify import to the official
3.4.17 package. The build checks that the patched module is included and the
older embedded source is excluded. No minified sanitizer code is edited.

The existing React editor and AMD loading contract are retained. The asset URL
is now `/vendor/monaco-0.57.0-dompurify-3.4.17/vs`. Preparation removes the obsolete
generated public directory. Verification rebuilds from installed sources and
compares every asset and both licenses, rejects unexpected files, and refuses
to accept the old vulnerable directory alongside the new bundle.

The lockfile also resolves Zod 4.6.7, body-parser 2.4.0 and Undici 7.30.1. The
Undici override targets 7.29.1 only, retaining the separate 6.x dependency used
by dotenvx. OpenNext remains 1.20.13; its previously verified runtime fix is not
replaced by the downgrade suggested by `npm audit fix --force`.

## Evidence and boundaries

- PASS: `npm audit --omit=dev` reports zero vulnerabilities.
- PASS: 369 Node tests against a fresh, isolated SQLite database; all migrations,
  typecheck and lint. The first run hit a malformed older local database and
  was stopped; it is not counted as passing evidence.
- PASS: the asset regression accepts the rebuilt bundle and rejects a modified
  asset or a leftover vulnerable directory.
- PASS: standalone production build and verification of its packaged editor
  assets against the patched module sources.
- PASS: Browser Harness acceptance in a separate local workspace. The actual
  Python Strategy panel loaded the versioned loader, editor, stylesheet, font
  and worker with HTTP 200. Python keyword/comment/number tokenization,
  keyboard text insertion, draft recovery after reload and all seven SDK
  completion suggestions worked. An injected diagnostic marker rendered its
  error underline; this checks editor rendering, not Helper error propagation.
- PASS: an instrumented editor worker exchanged 27 outgoing / 26 incoming
  messages and returned the expected character-level diff. No page, unhandled
  rejection or worker errors were captured during that bounded observation.
  The supplied logo and Python editor were visually inspected; favicon PNG,
  ICO and Apple touch icon returned HTTP 200. Existing workspaces were retained.
- Local Cloudflare assembly failed on Windows with `EPERM` creating a Prisma
  symlink. The candidate needs its own Linux CI assembly and workerd smoke;
  historical workflow passes do not satisfy that gate.
- Production deployment and the remaining real OAuth/two-account isolation,
  signing and elapsed reliability gates are not established by these checks.

Logs are under ignored `artifacts/helper-redesign/resume-*`. The older database
was not repaired or replaced. The old generated standalone editor assets were
moved to the ignored artifact directory, preserving them for diagnosis.
Browser evidence includes `resume-browser-runtime.log`,
`resume-browser-worker.log`, `resume-browser-diagnostics.log` and screenshots.
The Helper was not running during this editor check; research execution,
report download and fresh restore were not exercised by it.

## Upstream references

- Monaco bundled-sanitizer issue: https://github.com/microsoft/monaco-editor/issues/5517
- DOMPurify patched release: https://github.com/cure53/DOMPurify/releases/tag/3.4.17
- body-parser advisory: https://github.com/advisories/GHSA-27r3-jxmh-p828
- Undici advisory: https://github.com/advisories/GHSA-xjj6-f33q-929c
- Zod advisory: https://github.com/advisories/GHSA-mrhx-c7xc-m3w5
