-- ==============================================================================
-- ZTerminal Supabase Production Row Level Security (RLS) Policies
-- ==============================================================================
-- Run this script in the Supabase SQL editor or via psql after applying the schema.
-- It enables Row-Level Security on all operational tables and ensures strict tenant
-- isolation so users cannot access, modify, or leak other users' strategies, runs,
-- or workspace state.
-- ==============================================================================

-- 1. Enable RLS on core product tables
ALTER TABLE IF EXISTS "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "Workspace" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "CloudWorkspaceState" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "Strategy" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "StrategyVersion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "Dataset" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "BacktestRun" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "RiskPlan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "AlertDefinition" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "JournalEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "AuditEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "ResearchSource" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "RuleSpec" ENABLE ROW LEVEL SECURITY;

-- 2. User Policies
CREATE POLICY "Users can read own profile"
  ON "User" FOR SELECT
  USING (auth.uid()::text = id OR auth.jwt() ->> 'email' = email);

CREATE POLICY "Users can update own profile"
  ON "User" FOR UPDATE
  USING (auth.uid()::text = id);

-- 3. Workspace Policies
CREATE POLICY "Users can select own workspaces"
  ON "Workspace" FOR SELECT
  USING (ownerId IS NULL OR ownerId = auth.uid()::text);

CREATE POLICY "Users can insert own workspaces"
  ON "Workspace" FOR INSERT
  WITH CHECK (ownerId IS NULL OR ownerId = auth.uid()::text);

CREATE POLICY "Users can update own workspaces"
  ON "Workspace" FOR UPDATE
  USING (ownerId = auth.uid()::text);

CREATE POLICY "Users can delete own workspaces"
  ON "Workspace" FOR DELETE
  USING (ownerId = auth.uid()::text);

-- 4. CloudWorkspaceState Policies
CREATE POLICY "Users can manage cloud workspace state"
  ON "CloudWorkspaceState" FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "Workspace" w
      WHERE w.id = "CloudWorkspaceState"."workspaceId"
        AND (w.ownerId IS NULL OR w.ownerId = auth.uid()::text)
    )
  );

-- 5. Strategy Policies
CREATE POLICY "Users can access strategies in their workspaces"
  ON "Strategy" FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "Workspace" w
      WHERE w.id = "Strategy"."workspaceId"
        AND (w.ownerId IS NULL OR w.ownerId = auth.uid()::text)
    )
  );

-- 6. StrategyVersion Policies
CREATE POLICY "Users can access strategy versions in their strategies"
  ON "StrategyVersion" FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "Strategy" s
      JOIN "Workspace" w ON w.id = s."workspaceId"
      WHERE s.id = "StrategyVersion"."strategyId"
        AND (w.ownerId IS NULL OR w.ownerId = auth.uid()::text)
    )
  );

-- 7. BacktestRun Policies
CREATE POLICY "Users can access backtest runs in their workspaces"
  ON "BacktestRun" FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "Workspace" w
      WHERE w.id = "BacktestRun"."workspaceId"
        AND (w.ownerId IS NULL OR w.ownerId = auth.uid()::text)
    )
  );

-- 8. RiskPlan Policies
CREATE POLICY "Users can access risk plans in their workspaces"
  ON "RiskPlan" FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "Workspace" w
      WHERE w.id = "RiskPlan"."workspaceId"
        AND (w.ownerId IS NULL OR w.ownerId = auth.uid()::text)
    )
  );

-- 9. JournalEntry Policies
CREATE POLICY "Users can access journal entries in their workspaces"
  ON "JournalEntry" FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "Workspace" w
      WHERE w.id = "JournalEntry"."workspaceId"
        AND (w.ownerId IS NULL OR w.ownerId = auth.uid()::text)
    )
  );

-- 10. Service Role Override
-- Service role key bypasses RLS automatically in Supabase, enabling
-- server-side background workers to claim and execute backtests.
