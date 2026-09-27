# Cloud sign-in readiness

See [the current authentication audit](AUTH_AUDIT.md) for the verified production failure, architecture, required Google Cloud and Cloudflare settings, database setup, and remaining verification.

The previously recorded Google OAuth web client was configured for `https://zterminal.onrender.com`; the active checked-in Worker origin is `https://zterminal-web.zephyria-inc.workers.dev`. This historical setting must be updated in Google Cloud before the Worker can complete a callback. The old document also described a `CLOUD_SYNC_ENABLED` release gate that is no longer present in the code; current enablement is determined by the Google credentials, session secret, public origin, and durable database URL.
