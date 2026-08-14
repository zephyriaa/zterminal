-- CreateTable
CREATE TABLE "ResearchSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "sourceType" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "sourceText" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "rightsNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ResearchSource_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ResearchSourceExcerpt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceId" TEXT NOT NULL,
    "locator" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "reviewerConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ResearchSourceExcerpt_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ResearchSource" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RuleSpec" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "deferredVariables" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RuleSpec_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RuleSpec_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ResearchSource" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RuleSpecRevision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ruleSpecId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "entryRule" TEXT NOT NULL,
    "exitRule" TEXT NOT NULL,
    "sizingRule" TEXT NOT NULL,
    "excerptIds" TEXT NOT NULL DEFAULT '[]',
    "scopeValidation" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RuleSpecRevision_ruleSpecId_fkey" FOREIGN KEY ("ruleSpecId") REFERENCES "RuleSpec" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DataRequirementAssessment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ruleSpecRevisionId" TEXT NOT NULL,
    "requirements" TEXT NOT NULL,
    "selectedDataset" TEXT,
    "readyForGeneration" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DataRequirementAssessment_ruleSpecRevisionId_fkey" FOREIGN KEY ("ruleSpecRevisionId") REFERENCES "RuleSpecRevision" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DatasetImport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "datasetId" TEXT,
    "sourceMode" TEXT NOT NULL,
    "fileHash" TEXT,
    "schemaVersion" TEXT NOT NULL,
    "qualityReport" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DatasetImport_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DatasetImport_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "Dataset" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GeneratedStrategyArtifact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ruleSpecRevisionId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "semanticManifest" TEXT NOT NULL,
    "assumptions" TEXT NOT NULL,
    "unsupportedRequirements" TEXT NOT NULL DEFAULT '[]',
    "extrasDetected" TEXT NOT NULL DEFAULT '[]',
    "approval" TEXT NOT NULL,
    "generatorProvider" TEXT NOT NULL,
    "generatorReference" TEXT,
    "contentHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GeneratedStrategyArtifact_ruleSpecRevisionId_fkey" FOREIGN KEY ("ruleSpecRevisionId") REFERENCES "RuleSpecRevision" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VariableChange" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "before" TEXT NOT NULL,
    "after" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VariableChange_runId_fkey" FOREIGN KEY ("runId") REFERENCES "BacktestRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProtocolDecision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "ruleSpecId" TEXT,
    "type" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProtocolDecision_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProtocolDecision_ruleSpecId_fkey" FOREIGN KEY ("ruleSpecId") REFERENCES "RuleSpec" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BacktestRun" (
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
    "runClass" TEXT NOT NULL DEFAULT 'LEGACY',
    "baselineFingerprint" TEXT,
    "generatedArtifactId" TEXT,
    "parentRunId" TEXT,
    "protocolWarnings" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BacktestRun_generatedArtifactId_fkey" FOREIGN KEY ("generatedArtifactId") REFERENCES "GeneratedStrategyArtifact" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BacktestRun_parentRunId_fkey" FOREIGN KEY ("parentRunId") REFERENCES "BacktestRun" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BacktestRun_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BacktestRun_strategyVersionId_fkey" FOREIGN KEY ("strategyVersionId") REFERENCES "StrategyVersion" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BacktestRun_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "Dataset" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_BacktestRun" ("config", "createdAt", "datasetId", "determinismHash", "equityCurve", "id", "metrics", "parameters", "strategyVersionId", "tradeLog", "validationStatus", "workspaceId") SELECT "config", "createdAt", "datasetId", "determinismHash", "equityCurve", "id", "metrics", "parameters", "strategyVersionId", "tradeLog", "validationStatus", "workspaceId" FROM "BacktestRun";
DROP TABLE "BacktestRun";
ALTER TABLE "new_BacktestRun" RENAME TO "BacktestRun";
CREATE UNIQUE INDEX "BacktestRun_determinismHash_key" ON "BacktestRun"("determinismHash");
CREATE UNIQUE INDEX "BacktestRun_baselineFingerprint_key" ON "BacktestRun"("baselineFingerprint");
CREATE INDEX "BacktestRun_workspaceId_createdAt_idx" ON "BacktestRun"("workspaceId", "createdAt");
CREATE INDEX "BacktestRun_strategyVersionId_idx" ON "BacktestRun"("strategyVersionId");
CREATE INDEX "BacktestRun_datasetId_idx" ON "BacktestRun"("datasetId");
CREATE INDEX "BacktestRun_generatedArtifactId_idx" ON "BacktestRun"("generatedArtifactId");
CREATE INDEX "BacktestRun_parentRunId_idx" ON "BacktestRun"("parentRunId");
CREATE TABLE "new_StrategyVersion" (
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
    "generatedArtifactId" TEXT,
    "protocolClassification" TEXT NOT NULL DEFAULT 'NON_PROTOCOL',
    "parentVersionId" TEXT,
    CONSTRAINT "StrategyVersion_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "Strategy" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StrategyVersion_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "Dataset" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StrategyVersion_generatedArtifactId_fkey" FOREIGN KEY ("generatedArtifactId") REFERENCES "GeneratedStrategyArtifact" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StrategyVersion_parentVersionId_fkey" FOREIGN KEY ("parentVersionId") REFERENCES "StrategyVersion" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_StrategyVersion" ("createdAt", "datasetId", "id", "language", "parameterSchema", "riskModel", "source", "sourceHash", "strategyId", "structuredDefinition", "version") SELECT "createdAt", "datasetId", "id", "language", "parameterSchema", "riskModel", "source", "sourceHash", "strategyId", "structuredDefinition", "version" FROM "StrategyVersion";
DROP TABLE "StrategyVersion";
ALTER TABLE "new_StrategyVersion" RENAME TO "StrategyVersion";
CREATE INDEX "StrategyVersion_strategyId_idx" ON "StrategyVersion"("strategyId");
CREATE INDEX "StrategyVersion_datasetId_idx" ON "StrategyVersion"("datasetId");
CREATE INDEX "StrategyVersion_sourceHash_idx" ON "StrategyVersion"("sourceHash");
CREATE UNIQUE INDEX "StrategyVersion_strategyId_version_key" ON "StrategyVersion"("strategyId", "version");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ResearchSource_workspaceId_createdAt_idx" ON "ResearchSource"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "ResearchSource_contentHash_idx" ON "ResearchSource"("contentHash");

-- CreateIndex
CREATE INDEX "ResearchSourceExcerpt_sourceId_idx" ON "ResearchSourceExcerpt"("sourceId");

-- CreateIndex
CREATE INDEX "RuleSpec_workspaceId_stage_idx" ON "RuleSpec"("workspaceId", "stage");

-- CreateIndex
CREATE INDEX "RuleSpec_sourceId_idx" ON "RuleSpec"("sourceId");

-- CreateIndex
CREATE INDEX "RuleSpecRevision_contentHash_idx" ON "RuleSpecRevision"("contentHash");

-- CreateIndex
CREATE UNIQUE INDEX "RuleSpecRevision_ruleSpecId_revision_key" ON "RuleSpecRevision"("ruleSpecId", "revision");

-- CreateIndex
CREATE INDEX "DataRequirementAssessment_ruleSpecRevisionId_createdAt_idx" ON "DataRequirementAssessment"("ruleSpecRevisionId", "createdAt");

-- CreateIndex
CREATE INDEX "DatasetImport_workspaceId_createdAt_idx" ON "DatasetImport"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "DatasetImport_datasetId_idx" ON "DatasetImport"("datasetId");

-- CreateIndex
CREATE INDEX "GeneratedStrategyArtifact_ruleSpecRevisionId_createdAt_idx" ON "GeneratedStrategyArtifact"("ruleSpecRevisionId", "createdAt");

-- CreateIndex
CREATE INDEX "GeneratedStrategyArtifact_contentHash_idx" ON "GeneratedStrategyArtifact"("contentHash");

-- CreateIndex
CREATE UNIQUE INDEX "VariableChange_runId_key" ON "VariableChange"("runId");

-- CreateIndex
CREATE INDEX "ProtocolDecision_workspaceId_createdAt_idx" ON "ProtocolDecision"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "ProtocolDecision_ruleSpecId_createdAt_idx" ON "ProtocolDecision"("ruleSpecId", "createdAt");
