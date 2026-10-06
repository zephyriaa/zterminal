-- Run once on an existing PostgreSQL or SQLite deployment after installing the identity-only adapter.
-- Identity and ZTerminal sessions are preserved. Google API tokens are not used by ZTerminal.
UPDATE "Account"
SET "access_token" = NULL, "refresh_token" = NULL, "id_token" = NULL
WHERE "provider" = 'google';
