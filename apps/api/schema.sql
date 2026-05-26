CREATE TABLE IF NOT EXISTS project_memory (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  memory_type TEXT NOT NULL,
  content_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_project_memory_project
ON project_memory(project_id);

CREATE INDEX IF NOT EXISTS idx_project_memory_type
ON project_memory(memory_type);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,

  prompt TEXT NOT NULL,

  status TEXT NOT NULL DEFAULT 'running',

  phase TEXT NOT NULL DEFAULT 'product_spec',

  target TEXT NOT NULL DEFAULT 'web-app',

  score INTEGER NOT NULL DEFAULT 0,

  attempts INTEGER NOT NULL DEFAULT 0,

  max_attempts INTEGER NOT NULL DEFAULT 12,

  files_json TEXT NOT NULL DEFAULT '[]',

  logs_json TEXT NOT NULL DEFAULT '[]',

  error TEXT DEFAULT '',

  created_at INTEGER NOT NULL,

  updated_at INTEGER NOT NULL,

  next_run_at INTEGER NOT NULL,

  last_score INTEGER NOT NULL DEFAULT 0,

  stagnant_steps INTEGER NOT NULL DEFAULT 0,

  strategy TEXT NOT NULL DEFAULT 'normal'
);

CREATE INDEX IF NOT EXISTS idx_jobs_status
ON jobs(status);

CREATE INDEX IF NOT EXISTS idx_jobs_phase
ON jobs(phase);

CREATE INDEX IF NOT EXISTS idx_jobs_next_run
ON jobs(next_run_at);

CREATE INDEX IF NOT EXISTS idx_jobs_updated_at
ON jobs(updated_at);

CREATE INDEX IF NOT EXISTS idx_jobs_status_next_run
ON jobs(status, next_run_at);
