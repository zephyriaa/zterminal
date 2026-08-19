# Institutional UI Validation

**Scope:** Local validation of the restrained landing and account presentation introduced after the platform-foundation release.

## Visual-system outcome

The public product surface now uses a graphite/blue-black base, thin neutral dividers, low-radius controls, flat information panels, and a single desaturated action treatment. The previous bright cyan-violet primary gradients, large 14–18 px card rounding, glow-heavy action states, animated product-preview entrance, and decorative orbital contract diagram have been removed or overridden. Teal remains available for actual verified/live market-state semantics rather than decorative calls to action.

| Surface | Verified local result |
|---|---|
| `/` landing route | The hero now presents the plain-language title **“Research the market with evidence.”** with restrained primary and secondary actions. The product preview is a flat, neutral market snapshot and the capability blocks use a continuous information grid rather than floating promotional cards. |
| `/account` guest route | The account route renders **“Research ownership, configured deliberately.”** and correctly states that identity and durable storage must be configured and verified before signed-in workspaces are enabled. |
| Account actions | The primary action is a near-square dark graphite control; the guest route is a neutral outlined control. The page does not advertise password storage, trading credentials, or unverified workspace synchronization. |
| Terminal shared controls | Navigation, timeframe, terminal actions, rails, drawers, chart frames, and selected controls use neutral surfaces and 4–6 px corners. Live/verified semantic colours were not repurposed as general decoration. |

## Browser evidence

The local Vite application rendered both routes successfully on 2026-08-19. The landing page exposed the revised navigation and action labels, while the account page rendered the revised guest disclosure and retained the safe `/terminal` guest fallback. Static validation (`pnpm check`) completed successfully after the component and stylesheet edits.

## Account implementation boundary

This UI change intentionally does not claim that Google or Firebase login is active. The existing account button still dispatches the existing configured-provider login helper. A real provider selection, owner-controlled credentials, backend token verification, HTTP-only application session, and durable workspace store are required before enabling a production sign-in claim. The recommended options and required controls are documented in [Institutional UI and Account Plan](./INSTITUTIONAL_UI_AND_ACCOUNT_PLAN.md).
