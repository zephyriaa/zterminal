-- Additive native identity scope only. No workspace/data migration.
CREATE TABLE "NativeAuthorizationCode" (
 "codeHash" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL,
 "challenge" TEXT NOT NULL, "redirectUri" TEXT NOT NULL,
 "expiresAt" DATETIME NOT NULL, "consumedAt" DATETIME, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "NativeAuthorizationCode_expiresAt_idx" ON "NativeAuthorizationCode"("expiresAt");
CREATE INDEX "NativeAuthorizationCode_userId_createdAt_idx" ON "NativeAuthorizationCode"("userId","createdAt");
CREATE TABLE "NativeDeviceSession" (
 "id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL, "name" TEXT NOT NULL,
 "scope" TEXT NOT NULL DEFAULT 'native:identity', "accessHash" TEXT NOT NULL,
 "accessExpiresAt" DATETIME NOT NULL, "expiresAt" DATETIME NOT NULL,
 "revokedAt" DATETIME, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "NativeDeviceSession_accessHash_key" ON "NativeDeviceSession"("accessHash");
CREATE INDEX "NativeDeviceSession_userId_idx" ON "NativeDeviceSession"("userId");
CREATE INDEX "NativeDeviceSession_expiresAt_idx" ON "NativeDeviceSession"("expiresAt");
CREATE TABLE "NativeRefreshToken" (
 "tokenHash" TEXT NOT NULL PRIMARY KEY, "sessionId" TEXT NOT NULL, "usedAt" DATETIME,
 FOREIGN KEY ("sessionId") REFERENCES "NativeDeviceSession"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "NativeRefreshToken_sessionId_idx" ON "NativeRefreshToken"("sessionId");
