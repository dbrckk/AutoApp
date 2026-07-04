import type { Env } from "./types";
import { listPersistentJobs, runPersistentJobStep } from "./jobs";

const BATCH_SIZE = 3;

export async function runEligibleScheduledJobs(env: Env) {
  if (!env.DB) return;

  const now = Date.now();
  const jobs = await listPersistentJobs(env.DB);
  const eligible = jobs
    .filter((job) => isEligible(job, now))
    .sort((a, b) => Number(a.next_run_at || 0) - Number(b.next_run_at || 0))
    .slice(0, BATCH_SIZE);

  for (const job of eligible) {
    try {
      await runPersistentJobStep(env, job.id);
    } catch (error) {
      console.error("Scheduled job failed", job.id, error);
    }
  }
}

function isEligible(job: Awaited<ReturnType<typeof listPersistentJobs>>[number], now: number) {
  if (Number(job.next_run_at || 0) > now) return false;
  if (job.status === "running") return true;
  if (job.status === "done" && job.infinite) return true;
  return false;
}
