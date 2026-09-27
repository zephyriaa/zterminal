# Cloud sign-in readiness

See [the current authentication audit](AUTH_AUDIT.md) for the verified production failure, architecture, required Google Cloud and Cloudflare settings, database setup, and remaining verification.

The Google Cloud project `zterminal` has a `ZTerminal Web` OAuth client configured for the active Worker origin `https://zterminal-web.zephyria-inc.workers.dev` and its exact `/api/auth/callback/google` callback. The app is in Testing mode, so only listed test users can sign in until branding and publication are completed. The Worker connects to PostgreSQL through Prisma's `pg` driver adapter; its `DATABASE_URL` must be a PostgreSQL connection string. The old document also described a `CLOUD_SYNC_ENABLED` release gate that is no longer present in the code; current enablement is determined by the Google credentials, session secret, public origin, and durable database URL.
