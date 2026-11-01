BEGIN;
-- Additive native identity scope only. No workspace/data migration.
CREATE TABLE "NativeAuthorizationCode" (
 "codeHash" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL,
 "challenge" TEXT NOT NULL, "redirectUri" TEXT NOT NULL,
 "expiresAt" TIMESTAMP(3) NOT NULL, "consumedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "NativeAuthorizationCode_expiresAt_idx" ON "NativeAuthorizationCode"("expiresAt");
CREATE INDEX "NativeAuthorizationCode_userId_createdAt_idx" ON "NativeAuthorizationCode"("userId","createdAt");
CREATE TABLE "NativeDeviceSession" (
 "id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL, "name" TEXT NOT NULL,
 "scope" TEXT NOT NULL DEFAULT 'native:identity', "accessHash" TEXT NOT NULL,
 "accessExpiresAt" TIMESTAMP(3) NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL,
 "revokedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "NativeDeviceSession_accessHash_key" ON "NativeDeviceSession"("accessHash");
CREATE INDEX "NativeDeviceSession_userId_idx" ON "NativeDeviceSession"("userId");
CREATE INDEX "NativeDeviceSession_expiresAt_idx" ON "NativeDeviceSession"("expiresAt");
CREATE TABLE "NativeRefreshToken" (
 "tokenHash" TEXT NOT NULL PRIMARY KEY, "sessionId" TEXT NOT NULL, "usedAt" TIMESTAMP(3),
 FOREIGN KEY ("sessionId") REFERENCES "NativeDeviceSession"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "NativeRefreshToken_sessionId_idx" ON "NativeRefreshToken"("sessionId");

-- Auth.js identity is not auth.uid(). These tables have no browser Data API path.
ALTER TABLE "NativeAuthorizationCode" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NativeDeviceSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NativeRefreshToken" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "NativeAuthorizationCode", "NativeDeviceSession", "NativeRefreshToken" FROM PUBLIC;
DO $$
DECLARE browser_role text;
BEGIN
  FOREACH browser_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = browser_role) THEN
      EXECUTE format('REVOKE ALL ON "NativeAuthorizationCode", "NativeDeviceSession", "NativeRefreshToken" FROM %I', browser_role);
    END IF;
  END LOOP;
END $$;
COMMIT;
