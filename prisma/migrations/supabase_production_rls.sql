-- ZTerminal authenticates with Auth.js, not Supabase Auth. auth.uid() does not
-- identify an Auth.js User.id, so email or NULL-owner RLS policies are unsafe.
-- Apply only if PostgreSQL is hosted by Supabase and the server connects with
-- a trusted role that bypasses RLS. Browser anon/authenticated roles receive
-- no direct access; all cloud reads and writes go through owner-scoped APIs.

DROP POLICY IF EXISTS "Users can read own profile" ON "User";
DROP POLICY IF EXISTS "Users can update own profile" ON "User";
DROP POLICY IF EXISTS "Users can select own workspaces" ON "Workspace";
DROP POLICY IF EXISTS "Users can insert own workspaces" ON "Workspace";
DROP POLICY IF EXISTS "Users can update own workspaces" ON "Workspace";
DROP POLICY IF EXISTS "Users can delete own workspaces" ON "Workspace";
DROP POLICY IF EXISTS "Users can manage cloud workspace state" ON "CloudWorkspaceState";
DROP POLICY IF EXISTS "Users can access strategies in their workspaces" ON "Strategy";
DROP POLICY IF EXISTS "Users can access strategy versions in their strategies" ON "StrategyVersion";
DROP POLICY IF EXISTS "Users can access backtest runs in their workspaces" ON "BacktestRun";
DROP POLICY IF EXISTS "Users can access risk plans in their workspaces" ON "RiskPlan";
DROP POLICY IF EXISTS "Users can access journal entries in their workspaces" ON "JournalEntry";

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'User', 'Account', 'Session', 'VerificationToken', 'Workspace',
    'CloudWorkspaceState', 'Strategy', 'StrategyVersion', 'Dataset',
    'BacktestRun', 'ResearchSource', 'ResearchSourceExcerpt', 'RuleSpec',
    'RuleSpecRevision', 'DataRequirementAssessment', 'DatasetImport',
    'GeneratedStrategyArtifact', 'VariableChange', 'ProtocolDecision',
    'RiskPlan', 'AlertDefinition', 'JournalEntry', 'AuditEvent'
  ] LOOP
    IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
      EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', table_name);
    END IF;
  END LOOP;
END $$;
