# Platform Foundation Validation

## Scope

This record validates the public product foundation added on the `product/orderflow-research-terminal` branch: a non-terminal default route, an account route, and an explicit terminal route. The changes are implemented in [`client/src/App.tsx`](../client/src/App.tsx), [`client/src/pages/LandingPage.tsx`](../client/src/pages/LandingPage.tsx), [`client/src/pages/AccountPage.tsx`](../client/src/pages/AccountPage.tsx), and the associated visual rules in [`client/src/index.css`](../client/src/index.css).

> **Boundary:** The account surface does not claim durable cloud workspaces are available. In the current Render configuration, no database or OAuth/JWT environment has been configured; guest preferences therefore remain browser-local unless an authenticated backend becomes available.

## Route contract

| Route | Intended audience | Validated behaviour | Data boundary |
|---|---|---|---|
| `/` | Public visitor | Presents the product positioning, capability overview, data-contract framing, and paths to the terminal or account view. | No account requirement and no market-data persistence claim. |
| `/account` | Guest or authenticated visitor | Presents account state and the available sign-in path without fabricating a durable workspace. | Guest state remains browser-local; the account view makes storage conditions visible. |
| `/terminal` | Research workstation user | Presents the market, chart, studies, Indicator Lab, and order-flow workspace. | Public-market research only; no broker route or execution capability. |

## Browser evidence

The local application was exercised at `/terminal` after the routing foundation was added. The workstation remained reachable and rendered a verified Gate.io chart while the new landing/account routing code was present. The browser inspection also confirmed that selecting a different market preserved the prior verified chart until the newly requested data was verified, rather than replacing the workspace with unverified data.

| Check | Result |
|---|---|
| Public landing implementation present | Pass |
| Account route implementation present | Pass |
| Explicit `/terminal` workstation route present | Pass |
| Existing terminal interface remained reachable after routing change | Pass |
| Browser-local storage disclosure retained | Pass |
| Durable account/workspace functionality falsely advertised | Pass — not advertised |

## Quality gates

The combined platform change passed static checking, the full test suite, and the production build on 2026-08-18 (local validation environment).

| Gate | Result |
|---|---|
| `pnpm check` | Pass |
| `pnpm test` | Pass — 23 test files, 80 tests |
| `pnpm build` | Pass |

## Follow-up required for real accounts

The existing authentication integration must not be treated as a deployed account system until the production service receives a durable `DATABASE_URL`, an `OAUTH_SERVER_URL`, and a strong `JWT_SECRET`, then those settings are validated using an actual sign-in and workspace-save round trip. Until then, the account page is intentionally an access and disclosure surface rather than a promise of cloud-synced research.
