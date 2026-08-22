-- ZTerminal Research V2 PostgreSQL schema.
-- This migration is additive. Apply only to a dedicated PostgreSQL database after
-- the SQLite export/checksum process has completed.

CREATE TABLE IF NOT EXISTS code_artifact (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('indicator', 'strategy')),
  language TEXT NOT NULL CHECK (language IN ('python', 'pine', 'zs_archive')),
  source TEXT NOT NULL,
  source_hash TEXT NOT NULL UNIQUE,
  runtime_lock TEXT,
  environment_hash TEXT,
  rights_attestation TEXT,
  origin_kind TEXT NOT NULL,
  parent_artifact_id TEXT REFERENCES code_artifact(id),
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS conversion_report (
  id TEXT PRIMARY KEY,
  source_artifact_id TEXT NOT NULL REFERENCES code_artifact(id) ON DELETE RESTRICT,
  generated_artifact_id TEXT REFERENCES code_artifact(id) ON DELETE SET NULL,
  converter_version TEXT NOT NULL,
  source_version TEXT NOT NULL,
  construct_report JSONB NOT NULL,
  diagnostics JSONB NOT NULL,
  semantic_changes JSONB NOT NULL,
  reviewer_accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dataset_manifest (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  native_symbol TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  requested_from_ms BIGINT NOT NULL,
  requested_to_ms BIGINT NOT NULL,
  bar_count INTEGER,
  quality_status TEXT NOT NULL,
  content_hash TEXT,
  provenance JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (requested_to_ms > requested_from_ms)
);

CREATE TABLE IF NOT EXISTS research_job (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('indicator_evaluation', 'strategy_backtest', 'pine_conversion')),
  status TEXT NOT NULL CHECK (status IN ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'UNSUPPORTED')),
  artifact_id TEXT REFERENCES code_artifact(id) ON DELETE RESTRICT,
  dataset_manifest_id TEXT REFERENCES dataset_manifest(id) ON DELETE RESTRICT,
  input_hash TEXT NOT NULL UNIQUE,
  request_payload JSONB NOT NULL,
  diagnostics JSONB NOT NULL DEFAULT '[]'::jsonb,
  worker_runtime_lock TEXT,
  engine_version TEXT,
  cancel_requested_at TIMESTAMPTZ,
  claimed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS research_job_queue_idx ON research_job (status, created_at) WHERE status = 'QUEUED';
CREATE INDEX IF NOT EXISTS code_artifact_workspace_idx ON code_artifact (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS dataset_manifest_lookup_idx ON dataset_manifest (provider, native_symbol, timeframe, requested_from_ms, requested_to_ms);

CREATE TABLE IF NOT EXISTS research_run (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL UNIQUE REFERENCES research_job(id) ON DELETE RESTRICT,
  artifact_id TEXT NOT NULL REFERENCES code_artifact(id) ON DELETE RESTRICT,
  dataset_manifest_id TEXT NOT NULL REFERENCES dataset_manifest(id) ON DELETE RESTRICT,
  runtime_lock TEXT NOT NULL,
  engine_version TEXT NOT NULL,
  execution_policy JSONB NOT NULL,
  result_hash TEXT NOT NULL UNIQUE,
  result_status TEXT NOT NULL,
  metrics JSONB,
  trade_log JSONB,
  equity_curve JSONB,
  provenance JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS validation_suite_run (
  id TEXT PRIMARY KEY,
  artifact_id TEXT REFERENCES code_artifact(id) ON DELETE RESTRICT,
  fixture_version TEXT NOT NULL,
  fixture_hash TEXT NOT NULL,
  expected JSONB NOT NULL,
  actual JSONB NOT NULL,
  tolerance JSONB NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
