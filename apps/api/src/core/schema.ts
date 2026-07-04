import type { Env } from "./types";

let checkedAt = 0;
const CHECK_TTL_MS = 60_000;

const JOB_COLUMNS = [
  "id", "prompt", "status", "phase", "target", "score", "attempts",
  "max_attempts", "files_json", "logs_json", "memory_json", "error",
  "created_at", "updated_at", "next_run_at", "last_score",
  "stagnant_steps", "strategy",
];

const MEMORY_COLUMNS = [
  "id", "project_id", "memory_type", "content_json", "created_at", "updated_at",
];

export async function ensureAppSchema(envOrDb: Env | D1Database) {
  const db = isD1Database(envOrDb) ? envOrDb : envOrDb.DB;
  if (!db) return { ok: false, error: "D1 DB binding missing", applied: [] as string[] };

  if (Date.now() - checkedAt < CHECK_TTL_MS) {
    return { ok: true, cached: true, applied: [] as string[] };
  }

  const applied: string[] = [];
  await ensureJobsTable(db, applied);
  await ensureColumn(db, "jobs", "memory_json", "TEXT DEFAULT '{}'", applied);
  await ensureProjectMemoryTable(db, applied);
  await ensureIndexes(db, applied);

  checkedAt = Date.now();
  return { ok: true, cached: false, applied };
}

export async function inspectAppSchema(envOrDb: Env | D1Database) {
  const db = isD1Database(envOrDb) ? envOrDb : envOrDb.DB;
  if (!db) return { ok: false, error: "D1 DB binding missing", tables: [] };

  const [jobsColumns, memoryColumns] = await Promise.all([
    getColumns(db, "jobs").catch(() => []),
    getColumns(db, "project_memory").catch(() => []),
  ]);

  const tables = [
    describeTable("jobs", jobsColumns, JOB_COLUMNS),
    describeTable("project_memory", memoryColumns, MEMORY_COLUMNS),
  ];

  return {
    ok: tables.every((table) => table.exists && table.missingColumns.length === 0),
    tables,
  };
}

async function ensureJobsTable(db: D1Database, applied: string[]) {
  await db.prepare(`
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
      memory_json TEXT DEFAULT '{}',
      error TEXT DEFAULT '',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      next_run_at INTEGER NOT NULL,
      last_score INTEGER DEFAULT 0,
      stagnant_steps INTEGER DEFAULT 0,
      strategy TEXT DEFAULT 'normal'
    )
  `).run();
  applied.push("ensure jobs table");
}

async function ensureProjectMemoryTable(db: D1Database, applied: string[]) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS project_memory (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      memory_type TEXT NOT NULL,
      content_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `).run();
  applied.push("ensure project_memory table");
}

async function ensureIndexes(db: D1Database, applied: string[]) {
  const statements = [
    "CREATE INDEX IF NOT EXISTS idx_jobs_status_next_run ON jobs(status, next_run_at)",
    "CREATE INDEX IF NOT EXISTS idx_jobs_updated_at ON jobs(updated_at)",
    "CREATE INDEX IF NOT EXISTS idx_project_memory_project ON project_memory(project_id)",
    "CREATE INDEX IF NOT EXISTS idx_project_memory_type ON project_memory(memory_type)",
  ];
  for (const statement of statements) await db.prepare(statement).run();
  applied.push("ensure D1 indexes");
}

async function ensureColumn(db: D1Database, table: string, column: string, definition: string, applied: string[]) {
  const columns = await getColumns(db, table);
  if (columns.includes(column)) return;
  await db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  applied.push(`add ${table}.${column}`);
}

async function getColumns(db: D1Database, table: string) {
  const result = await db.prepare(`PRAGMA table_info(${table})`).all();
  return (result.results || []).map((row: any) => String(row.name || "")).filter(Boolean);
}

function describeTable(name: string, columns: string[], requiredColumns: string[]) {
  return {
    name,
    exists: columns.length > 0,
    columns,
    requiredColumns,
    missingColumns: requiredColumns.filter((column) => !columns.includes(column)),
  };
}

function isD1Database(value: Env | D1Database): value is D1Database {
  return Boolean(value && typeof value === "object" && "prepare" in value && typeof (value as any).prepare === "function");
}
