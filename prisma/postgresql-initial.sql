-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "image" TEXT,
    "emailVerified" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CloudWorkspaceState" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "payload" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CloudWorkspaceState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Strategy" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Strategy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrategyVersion" (
    "id" TEXT NOT NULL,
    "strategyId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "language" TEXT NOT NULL,
    "source" TEXT,
    "structuredDefinition" TEXT,
    "parameterSchema" TEXT NOT NULL,
    "riskModel" TEXT NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "datasetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedArtifactId" TEXT,
    "protocolClassification" TEXT NOT NULL DEFAULT 'NON_PROTOCOL',
    "parentVersionId" TEXT,

    CONSTRAINT "StrategyVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dataset" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "symbols" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL,
    "exchangeTimezone" TEXT NOT NULL,
    "requestedFromMs" DOUBLE PRECISION NOT NULL,
    "requestedToMs" DOUBLE PRECISION NOT NULL,
    "contentHash" TEXT,
    "qualityStatus" TEXT NOT NULL,
    "provenance" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Dataset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BacktestRun" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BacktestRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchSource" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "sourceType" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "sourceText" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "rightsNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResearchSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchSourceExcerpt" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "locator" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "reviewerConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResearchSourceExcerpt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuleSpec" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "deferredVariables" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RuleSpec_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuleSpecRevision" (
    "id" TEXT NOT NULL,
    "ruleSpecId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "entryRule" TEXT NOT NULL,
    "exitRule" TEXT NOT NULL,
    "sizingRule" TEXT NOT NULL,
    "excerptIds" TEXT NOT NULL DEFAULT '[]',
    "scopeValidation" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RuleSpecRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataRequirementAssessment" (
    "id" TEXT NOT NULL,
    "ruleSpecRevisionId" TEXT NOT NULL,
    "requirements" TEXT NOT NULL,
    "selectedDataset" TEXT,
    "readyForGeneration" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataRequirementAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DatasetImport" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "datasetId" TEXT,
    "sourceMode" TEXT NOT NULL,
    "fileHash" TEXT,
    "schemaVersion" TEXT NOT NULL,
    "qualityReport" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DatasetImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedStrategyArtifact" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeneratedStrategyArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VariableChange" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "before" TEXT NOT NULL,
    "after" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VariableChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProtocolDecision" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "ruleSpecId" TEXT,
    "type" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProtocolDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskPlan" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "accountEquity" DOUBLE PRECISION NOT NULL,
    "maxRiskPerTrade" DOUBLE PRECISION NOT NULL,
    "maxDailyLoss" DOUBLE PRECISION NOT NULL,
    "maxWeeklyLoss" DOUBLE PRECISION NOT NULL,
    "maxGrossExposure" DOUBLE PRECISION NOT NULL,
    "policy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiskPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertDefinition" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "instrument" TEXT NOT NULL,
    "rule" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "cooldownMs" INTEGER NOT NULL,
    "lastTriggeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "strategyVersionId" TEXT,
    "backtestRunId" TEXT,
    "instrument" TEXT NOT NULL,
    "direction" TEXT,
    "entryTime" TIMESTAMP(3),
    "exitTime" TIMESTAMP(3),
    "entryPrice" DOUBLE PRECISION,
    "stopPrice" DOUBLE PRECISION,
    "targetPrice" DOUBLE PRECISION,
    "exitPrice" DOUBLE PRECISION,
    "quantity" DOUBLE PRECISION,
    "pnl" DOUBLE PRECISION,
    "rMultiple" DOUBLE PRECISION,
    "regime" TEXT,
    "context" TEXT NOT NULL,
    "notes" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "payload" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "Workspace_ownerId_idx" ON "Workspace"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "CloudWorkspaceState_workspaceId_key" ON "CloudWorkspaceState"("workspaceId");

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
CREATE UNIQUE INDEX "BacktestRun_baselineFingerprint_key" ON "BacktestRun"("baselineFingerprint");

-- CreateIndex
CREATE INDEX "BacktestRun_workspaceId_createdAt_idx" ON "BacktestRun"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "BacktestRun_strategyVersionId_idx" ON "BacktestRun"("strategyVersionId");

-- CreateIndex
CREATE INDEX "BacktestRun_datasetId_idx" ON "BacktestRun"("datasetId");

-- CreateIndex
CREATE INDEX "BacktestRun_generatedArtifactId_idx" ON "BacktestRun"("generatedArtifactId");

-- CreateIndex
CREATE INDEX "BacktestRun_parentRunId_idx" ON "BacktestRun"("parentRunId");

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

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CloudWorkspaceState" ADD CONSTRAINT "CloudWorkspaceState_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Strategy" ADD CONSTRAINT "Strategy_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrategyVersion" ADD CONSTRAINT "StrategyVersion_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "Strategy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrategyVersion" ADD CONSTRAINT "StrategyVersion_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "Dataset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrategyVersion" ADD CONSTRAINT "StrategyVersion_generatedArtifactId_fkey" FOREIGN KEY ("generatedArtifactId") REFERENCES "GeneratedStrategyArtifact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrategyVersion" ADD CONSTRAINT "StrategyVersion_parentVersionId_fkey" FOREIGN KEY ("parentVersionId") REFERENCES "StrategyVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dataset" ADD CONSTRAINT "Dataset_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BacktestRun" ADD CONSTRAINT "BacktestRun_generatedArtifactId_fkey" FOREIGN KEY ("generatedArtifactId") REFERENCES "GeneratedStrategyArtifact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BacktestRun" ADD CONSTRAINT "BacktestRun_parentRunId_fkey" FOREIGN KEY ("parentRunId") REFERENCES "BacktestRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BacktestRun" ADD CONSTRAINT "BacktestRun_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BacktestRun" ADD CONSTRAINT "BacktestRun_strategyVersionId_fkey" FOREIGN KEY ("strategyVersionId") REFERENCES "StrategyVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BacktestRun" ADD CONSTRAINT "BacktestRun_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "Dataset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchSource" ADD CONSTRAINT "ResearchSource_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchSourceExcerpt" ADD CONSTRAINT "ResearchSourceExcerpt_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ResearchSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleSpec" ADD CONSTRAINT "RuleSpec_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleSpec" ADD CONSTRAINT "RuleSpec_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ResearchSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleSpecRevision" ADD CONSTRAINT "RuleSpecRevision_ruleSpecId_fkey" FOREIGN KEY ("ruleSpecId") REFERENCES "RuleSpec"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataRequirementAssessment" ADD CONSTRAINT "DataRequirementAssessment_ruleSpecRevisionId_fkey" FOREIGN KEY ("ruleSpecRevisionId") REFERENCES "RuleSpecRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatasetImport" ADD CONSTRAINT "DatasetImport_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatasetImport" ADD CONSTRAINT "DatasetImport_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "Dataset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedStrategyArtifact" ADD CONSTRAINT "GeneratedStrategyArtifact_ruleSpecRevisionId_fkey" FOREIGN KEY ("ruleSpecRevisionId") REFERENCES "RuleSpecRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VariableChange" ADD CONSTRAINT "VariableChange_runId_fkey" FOREIGN KEY ("runId") REFERENCES "BacktestRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtocolDecision" ADD CONSTRAINT "ProtocolDecision_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtocolDecision" ADD CONSTRAINT "ProtocolDecision_ruleSpecId_fkey" FOREIGN KEY ("ruleSpecId") REFERENCES "RuleSpec"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskPlan" ADD CONSTRAINT "RiskPlan_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertDefinition" ADD CONSTRAINT "AlertDefinition_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_strategyVersionId_fkey" FOREIGN KEY ("strategyVersionId") REFERENCES "StrategyVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_backtestRunId_fkey" FOREIGN KEY ("backtestRunId") REFERENCES "BacktestRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
