CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  prompt TEXT NOT NULL,
  status TEXT NOT NULL,
  phase TEXT NOT NULL,
  target TEXT DEFAULT 'web-app',
  score INTEGER DEFAULT 0,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 12,
  files_json TEXT DEFAULT '[]',
  logs_json TEXT DEFAULT '[]',
  error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  next_run_at INTEGER NOT NULL,
  last_score INTEGER DEFAULT 0,
  stagnant_steps INTEGER DEFAULT 0,
  strategy TEXT DEFAULT 'normal'
);

CREATE INDEX IF NOT EXISTS idx_jobs_status_next_run
ON jobs(status, next_run_at);

CREATE INDEX IF NOT EXISTS idx_jobs_updated_at
ON jobs(updated_at);
