-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Workspace_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Strategy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Strategy_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StrategyVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "strategyId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "language" TEXT NOT NULL,
    "source" TEXT,
    "structuredDefinition" TEXT,
    "parameterSchema" TEXT NOT NULL,
    "riskModel" TEXT NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "datasetId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StrategyVersion_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "Strategy" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StrategyVersion_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "Dataset" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Dataset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "symbols" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL,
    "exchangeTimezone" TEXT NOT NULL,
    "requestedFromMs" INTEGER NOT NULL,
    "requestedToMs" INTEGER NOT NULL,
    "contentHash" TEXT,
    "qualityStatus" TEXT NOT NULL,
    "provenance" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Dataset_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BacktestRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "strategyVersionId" TEXT,
    "datasetId" TEXT,
    "determinismHash" TEXT NOT NULL,
    "config" TEXT NOT NULL,
    "parameters" TEXT NOT NULL,
    "metrics" TEXT NOT NULL,
    "tradeLog" TEXT NOT NULL,
    "equityCurve" TEXT NOT NULL,
    "validationStatus" TEXT NOT NULL DEFAULT 'unvalidated',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BacktestRun_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BacktestRun_strategyVersionId_fkey" FOREIGN KEY ("strategyVersionId") REFERENCES "StrategyVersion" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BacktestRun_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "Dataset" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RiskPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "accountEquity" REAL NOT NULL,
    "maxRiskPerTrade" REAL NOT NULL,
    "maxDailyLoss" REAL NOT NULL,
    "maxWeeklyLoss" REAL NOT NULL,
    "maxGrossExposure" REAL NOT NULL,
    "policy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RiskPlan_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AlertDefinition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "instrument" TEXT NOT NULL,
    "rule" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "cooldownMs" INTEGER NOT NULL,
    "lastTriggeredAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AlertDefinition_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "strategyVersionId" TEXT,
    "backtestRunId" TEXT,
    "instrument" TEXT NOT NULL,
    "direction" TEXT,
    "entryTime" DATETIME,
    "exitTime" DATETIME,
    "entryPrice" REAL,
    "stopPrice" REAL,
    "targetPrice" REAL,
    "exitPrice" REAL,
    "quantity" REAL,
    "pnl" REAL,
    "rMultiple" REAL,
    "regime" TEXT,
    "context" TEXT NOT NULL,
    "notes" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "JournalEntry_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "JournalEntry_strategyVersionId_fkey" FOREIGN KEY ("strategyVersionId") REFERENCES "StrategyVersion" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "JournalEntry_backtestRunId_fkey" FOREIGN KEY ("backtestRunId") REFERENCES "BacktestRun" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "payload" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Workspace_ownerId_idx" ON "Workspace"("ownerId");

-- CreateIndex
CREATE INDEX "Strategy_workspaceId_idx" ON "Strategy"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Strategy_workspaceId_name_key" ON "Strategy"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "StrategyVersion_strategyId_idx" ON "StrategyVersion"("strategyId");

-- CreateIndex
CREATE INDEX "StrategyVersion_datasetId_idx" ON "StrategyVersion"("datasetId");

-- CreateIndex
CREATE INDEX "StrategyVersion_sourceHash_idx" ON "StrategyVersion"("sourceHash");

-- CreateIndex
CREATE UNIQUE INDEX "StrategyVersion_strategyId_version_key" ON "StrategyVersion"("strategyId", "version");

-- CreateIndex
CREATE INDEX "Dataset_workspaceId_createdAt_idx" ON "Dataset"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "Dataset_contentHash_idx" ON "Dataset"("contentHash");

-- CreateIndex
CREATE UNIQUE INDEX "BacktestRun_determinismHash_key" ON "BacktestRun"("determinismHash");

-- CreateIndex
CREATE INDEX "BacktestRun_workspaceId_createdAt_idx" ON "BacktestRun"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "BacktestRun_strategyVersionId_idx" ON "BacktestRun"("strategyVersionId");

-- CreateIndex
CREATE INDEX "BacktestRun_datasetId_idx" ON "BacktestRun"("datasetId");

-- CreateIndex
CREATE INDEX "RiskPlan_workspaceId_updatedAt_idx" ON "RiskPlan"("workspaceId", "updatedAt");

-- CreateIndex
CREATE INDEX "AlertDefinition_workspaceId_enabled_idx" ON "AlertDefinition"("workspaceId", "enabled");

-- CreateIndex
CREATE INDEX "AlertDefinition_instrument_enabled_idx" ON "AlertDefinition"("instrument", "enabled");

-- CreateIndex
CREATE INDEX "JournalEntry_workspaceId_createdAt_idx" ON "JournalEntry"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "JournalEntry_strategyVersionId_idx" ON "JournalEntry"("strategyVersionId");

-- CreateIndex
CREATE INDEX "JournalEntry_backtestRunId_idx" ON "JournalEntry"("backtestRunId");

-- CreateIndex
CREATE INDEX "AuditEvent_workspaceId_createdAt_idx" ON "AuditEvent"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_entityType_entityId_idx" ON "AuditEvent"("entityType", "entityId");
