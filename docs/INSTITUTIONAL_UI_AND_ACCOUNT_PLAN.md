# Institutional UI and Account Plan

**Status:** Proposed implementation plan. The visual redesign can proceed immediately. Google sign-in requires a provider choice and owner-controlled credentials before it can be enabled in production.

## Design decision

ZTerminal should read as an **evidence-oriented market workstation**, not as a crypto promotion page. The existing product surface uses high-saturation cyan/violet gradients, large rounded containers, glow-heavy shadows, a decorative orbital diagram, and feature-card icon tiles. Those elements make the public pages feel closer to a consumer landing page than a serious research application.

The revised system will retain the dark base but use graphite and blue-black surfaces, restrained one-pixel dividers, near-square controls, a single muted blue accent for primary actions, and teal only for actual verified/live data. Buttons will distinguish actions by hierarchy rather than by colorful gradients: solid charcoal for the primary path, outlined graphite for secondary paths, and text-only navigation for tertiary paths. Cards will become flat information blocks with 4–6 px corners and no ambient glow. The landing page will use editorial typography, a compact market snapshot, and a proof-led structure; the account surface will use the same system.

| Element | Current treatment | Replacement treatment |
|---|---|---|
| Primary actions | Multi-colour gradients, rounded 9 px shapes, glow shadows | Near-square dark/navy solid button, light text, 4 px radius, no glow |
| Secondary actions | Translucent violet cards | Neutral outline or text action with a clear hover state |
| Status colours | Teal/violet used decoratively | Teal reserved for verified/live; amber and red reserved for state only |
| Cards and shells | Large 14–18 px corners, gradients, floating shadows | Flat panels, thin divider, 4–6 px corners, subtle surface contrast |
| Landing decoration | Sparkles, orbit rings, coloured preview bars | Source labels, timestamp rows, neutral grid/chart texture, compact data table |
| Typography | Display-led large hero with stylised emphasis | Editorial headline, tight supporting copy, consistent uppercase metadata |

## Google account architecture options

ZTerminal currently has a React/Express/tRPC application with an existing server-side account model and no production `DATABASE_URL`, `OAUTH_SERVER_URL`, or `JWT_SECRET`. It must not accept a browser-provided name, email, or user ID as proof of identity. A backend must validate the provider token, use the provider’s immutable subject identifier as the account key, and issue an application session over HTTPS. Google explicitly recommends verifying the token audience, issuer, signature, expiry, and CSRF signal; it also states that `sub`, not email, is the stable account identifier.[1]

| Approach | What it provides | Trade-offs | Cost | Setup complexity |
|---|---|---|---|---|
| **Firebase Authentication + Google** | Managed Google login now, optional additional providers later, and a compatible path to Firestore/Storage for workspaces | Adds a second identity/persistence platform alongside the existing Express/Drizzle model; requires a Firebase project, authorized domains, client config, and protected server credentials | Firebase Authentication supports a no-cost entry path; storage/database usage must be governed separately | Moderate |
| **Direct Google Identity + ZTerminal sessions** | Google-only login through the existing Express backend; a verified Google ID token is exchanged for ZTerminal’s HTTP-only session cookie and linked to the existing user/workspace tables | Fewer moving parts and less vendor coupling, but provider additions later need separate integration work | Google sign-in itself does not require Firebase; ZTerminal still needs a production database | Moderate, and lowest for the current codebase |
| **Existing OAuth foundation** | Reuses the integrated OAuth/session structure already in the project | Cannot go live until the missing Render OAuth and database configuration is provided; it is not a Google-specific product account system | Depends on the existing provider configuration | Lowest code change, but blocked today |

## Recommendation

For the current **Google-only** goal, use **direct Google Identity with a server-verified token and a ZTerminal HTTP-only application session**. It fits the existing Express/tRPC architecture and avoids introducing Firebase Authentication and Firestore before the workspace model is settled. The server should use Google’s supported Node verification library, validate the token against the web client ID, key users by `sub`, perform CSRF validation, and keep the resulting session cookie `Secure`, `HttpOnly`, and appropriately scoped.[1]

Firebase is still a valid choice if the product roadmap includes multiple social providers, phone/email authentication, Firebase-hosted security rules, or Firestore as the intended durable workspace store. If Firebase is selected, the web client must use the Google provider, and the ZTerminal server must verify Firebase ID tokens or exchange them for an HTTP-only session cookie rather than trusting browser state. Firebase’s own guidance supports this model and recommends CSRF protection for session exchange.[2] [3]

## Required owner-controlled setup

Neither option should be wired with placeholder values. Before enabling production login, the owner must provide or configure the selected platform’s identifiers and secrets in Render. For direct Google identity, this means a Google Cloud web OAuth client, `GOOGLE_CLIENT_ID`, a server session-signing secret, `DATABASE_URL`, and the production origin/redirect configuration. For Firebase, it means the Firebase web configuration, Google provider enabled, `zterminal.onrender.com` authorized, Firebase Admin service-account credentials stored as Render secrets, a server session-signing secret, and a durable workspace store.

Both approaches require migration of the current account presentation from a hypothetical OAuth state to an authenticated user record plus a durable per-user workspace contract. Guest research remains public and browser-local by design; signed-in status must never imply that a workspace has synchronized until the server confirms it.

## Implementation sequence

1. Replace the landing and account visual system, preserving current routes and truthful guest account boundaries.
2. Add account-domain tests and a typed provider-agnostic identity boundary; do not activate an external provider without credentials.
3. After the owner selects direct Google or Firebase, add the provider-specific exchange endpoint, session validation, user upsert, and durable workspace migration.
4. Test sign-in, sign-out, token rejection, CSRF rejection, expired-session handling, ownership isolation, and guest fallback before a separate production promotion.

## References

[1]: https://developers.google.com/identity/gsi/web/guides/verify-google-id-token "Google Identity: Verify the Google ID token on your server side"
[2]: https://firebase.google.com/docs/auth/web/google-signin "Firebase: Authenticate Using Google with JavaScript"
[3]: https://firebase.google.com/docs/auth/admin/manage-cookies "Firebase: Manage Session Cookies"
