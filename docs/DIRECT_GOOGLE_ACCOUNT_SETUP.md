# Direct Google Account Setup

This checklist enables the direct Google account implementation now present on the ZTerminal product branch. It does **not** require Firebase. Google provides identity; ZTerminal verifies the Google ID token server-side, creates its own secure session, and stores research workspaces in the existing database.

> Do not place secrets in the repository, browser code, screenshots, or chat messages. Configure them only in Render’s environment settings.

## 1. Create the Google web client

In [Google Cloud Console](https://console.cloud.google.com/), create or select the project that will own ZTerminal identity. Configure the OAuth consent screen, then create an **OAuth 2.0 Client ID** of type **Web application**. Add the following authorized JavaScript origins exactly:

| Environment | Authorized JavaScript origin |
|---|---|
| Production | `https://zterminal.onrender.com` |
| Local development | `http://localhost:3000` |

The implemented sign-in uses Google Identity Services’ browser callback flow. It does not need a redirect URI for the current popup/button implementation. Copy the generated value ending in `.apps.googleusercontent.com`; it is the **Google web client ID**, not a client secret.

## 2. Configure Render

Open the ZTerminal Render service environment configuration and set the following values. Render must perform a new build/deploy after the variables are saved.

| Render variable | Value | Handling |
|---|---|---|
| `GOOGLE_CLIENT_ID` | The generated Google web client ID | Public identifier, supplied to browser only after server configuration passes |
| `JWT_SECRET` | A newly generated, random secret of at least 32 characters | Server-only secret; never reuse the legacy value or commit it |
| `DATABASE_URL` | The provisioned MySQL/TiDB connection URL | Server-only secret; required for user and workspace ownership |

Use a password manager or secure local secret generator to create `JWT_SECRET`. Do not use a human phrase, a market symbol, or an identifier that appears in the repository. `VITE_GOOGLE_CLIENT_ID` is optional; the server returns the configured public client ID only when Google sign-in is otherwise enabled.

## 3. Provision durable workspace storage

The current durable model needs the existing `users`, `workspaces`, and `researchDrafts` tables. Apply the repository’s existing Drizzle migrations against the same database before enabling the public account claim. The database must be reachable by the Render service at runtime. The application deliberately keeps Google login disabled if the database setting, Google client ID, or session secret is absent.

## 4. Verify after deployment

Open `https://zterminal.onrender.com/account`. The disabled **Google sign-in requires deployment configuration** message should be replaced with Google’s native rectangular account control only after all configuration is valid. Sign in using a non-sensitive test Google account, confirm that the account route shows the Google-provided display profile, save one research draft, sign out, and confirm that the same account can return to its own workspace while a second account cannot see it.

## Security guarantees and limits

The service verifies the Google token on the server against the configured client ID and maps the immutable Google `sub` field to `google:<sub>`. Email is display data only. The browser never keeps its Google credential as the ZTerminal session; it is exchanged for a 14-day secure, HTTP-only ZTerminal cookie. A short-lived double-submit CSRF cookie guards the exchange. The product still exposes no broker route, execution capability, market-data credential storage, or cross-account research access.

## References

[1]: https://developers.google.com/identity/gsi/web/guides/verify-google-id-token "Google Identity Services: Verify the Google ID token on your server side"
[2]: https://developers.google.com/identity/gsi/web/guides/display-button "Google Identity Services: Display the Sign in with Google button"
