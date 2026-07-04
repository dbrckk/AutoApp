import type { Env } from "./types";
import { runPersistentJobStep } from "./jobs";

const BATCH_SIZE = 3;

export async function runEligibleScheduledJobs(env: Env) {
  if (!env.DB) return;

  const now = Date.now();
  const result = await env.DB
    .prepare(
      `SELECT id
       FROM jobs
       WHERE next_run_at <= ?
         AND (
           status = 'running'
           OR (
             status = 'done'
             AND lower(prompt) LIKE '%auto improve forever: true%'
           )
         )
       ORDER BY next_run_at ASC, updated_at ASC
       LIMIT ?`
    )
    .bind(now, BATCH_SIZE)
    .all();

  for (const row of result.results || []) {
    const id = String((row as { id?: string }).id || "");
    if (!id) continue;
    try {
      await runPersistentJobStep(env, id);
    } catch (error) {
      console.error("Scheduled job failed", id, error);
    }
  }
}
