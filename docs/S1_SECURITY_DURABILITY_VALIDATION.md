# S1 Security and Durable-Workspace Boundary

**Scope:** recovery branch only; no production deployment or promotion occurred. S1 adds bounded public-surface safeguards and dependency remediation without claiming that user accounts, cloud draft persistence, storage proxying, or OAuth are available in the current Render environment.

## Implemented Safeguards

| Area | Implemented control | Bound or behavior |
|---|---|---|
| Public APIs | Bounded fixed-window tRPC limiter applied to Gate.io market reads and closed ZS compiler diagnostics | 120 requests per minute per Express request identity; stale in-memory entries are evicted; no raw IP logging or durable identifier storage |
| Proxy identity | Express trusts one reverse-proxy hop | Enables the request IP exposed by the expected deployment proxy to key the public limiter; it does not create user identity |
| Session issuance | JWT secret guard at the SDK signing/verification boundary | Missing or fewer-than-32-character `JWT_SECRET` fails closed for OAuth session issuing/verification; it cannot silently sign with an empty key |
| HTTP surface | Express fingerprint disabled; `nosniff`, frame, referrer, and permissions-policy headers added | No file upload route is present; JSON body cap is 256 KB, URL-encoded cap is 32 KB with 100 parameters |
| Public functionality | Public market research remains readable when auth is unavailable | No broker route, order execution, arbitrary code execution, or durable mutation becomes available |
| Dependencies | Patched direct toolchain lines and workspace-level pnpm policy | pnpm 10.34.5, Vitest 3.2.7, Vite 7.3.6, PostCSS 8.5.26, and transitive tar 7.5.22; lockfile regenerated under supported workspace policy |

## Durable-Workspace Truthfulness

| Requirement | Current state | Consequence |
|---|---|---|
| `DATABASE_URL` | Not configured in the target Render environment | Protected draft listing/saving returns its explicit precondition failure; browser-local protocol state is not durable |
| `OAUTH_SERVER_URL` | Not configured in the target Render environment | OAuth cannot complete user authentication |
| `JWT_SECRET` | Not configured in the target Render environment | S1 rejects session issuance rather than accepting an empty signing key |
| Storage service credentials | Not configured | The storage proxy returns a configuration failure; no object persistence is claimed |

> **Operational boundary:** the current production target is a public, read-only research terminal. Durable workspaces may only be enabled after all four prerequisites are deliberately configured and separately tested. The recovery branch retains browser-local protocol state solely as a clearly disclosed temporary mechanism.

## Dependency Audit Record

A fresh `pnpm audit --json` was run after lockfile remediation. The initial audit disclosed 2 critical and 26 high findings, including outdated toolchain paths. The final locked dependency graph reports **0 critical**, **0 high**, **27 moderate**, and **8 low** findings. The remaining findings are transitive backlog, are recorded in the attached raw evidence, and must remain release-gated for ongoing review rather than being attributed to a package without a verified path comparison.

| Evidence | Result |
|---|---|
| [`pnpm-audit-s1-final.json`](./evidence/pnpm-audit-s1-final.json) | Raw final dependency-audit output: 0 critical, 0 high, 27 moderate, 8 low |
| Rate-limit contract tests | Passed: allowance, retry timing, window reset, identity isolation, and fallback |
| Session-secret contract tests | Passed: empty/weak secret rejection and valid key material |
| Router/auth focused tests | Passed after limited public procedures and session guard integration |
| Full `pnpm test` | Passed: 18 files, 55 tests |
| `pnpm build` | Passed with Vite 7.3.6 |

**S1 is complete on the recovery branch pending commit.** S1 does **not** enable new protected mutations or persistence. Any future database migration, OAuth setup, object storage configuration, or user-data restoration must be treated as a separate, user-approved production change with a fresh migration, backup, and security validation record.
