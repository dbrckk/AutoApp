import { Hono } from "hono";

import type { Env, PersistentJob } from "../core/types";
import {
  appendJobLog,
  createPersistentJob,
  getPersistentJob,
  listPersistentJobs,
  publicJob,
  resumePersistentJob,
  runPersistentJobStep,
  savePersistentJob,
} from "../core/jobs";
import { safeJsonArray } from "../core/files";
import { virtualBuildCheck } from "../core/build";
import { scoreProject } from "../core/scoring";
import { getTargetProfile } from "../core/targets";
import { createAutonomousReport } from "../core/reports";

export const jobsRoutes = new Hono<{ Bindings: Env }>();

const EXECUTION_LEASE_MS = 4 * 60_000;

jobsRoutes.get("/", async (c) => {
  if (!c.env.DB) return c.json({ ok: false, error: "D1 DB binding missing" }, 500);
  return c.json({ ok: true, jobs: await listPersistentJobs(c.env.DB) });
});

jobsRoutes.post("/create", startJob);
jobsRoutes.post("/autonomous", startJob);

jobsRoutes.delete("/:id", async (c) => {
  if (!c.env.DB) return c.json({ ok: false, error: "D1 DB binding missing" }, 500);
  const id = c.req.param("id");
  const job = await getPersistentJob(c.env.DB, id);
  if (!job) return c.json({ ok: false, error: "Job not found" }, 404);
  await c.env.DB.prepare("DELETE FROM jobs WHERE id = ?").bind(id).run();
  return c.json({ ok: true, id });
});

jobsRoutes.get("/:id", async (c) => {
  if (!c.env.DB) return c.json({ ok: false, error: "D1 DB binding missing" }, 500);
  const job = await getPersistentJob(c.env.DB, c.req.param("id"));
  if (!job) return c.json({ ok: false, error: "Job not found" }, 404);
  return c.json(publicJob(job));
});

jobsRoutes.get("/:id/logs", async (c) => {
  if (!c.env.DB) return c.json({ ok: false, error: "D1 DB binding missing" }, 500);
  const job = await getPersistentJob(c.env.DB, c.req.param("id"));
  if (!job) return c.json({ ok: false, error: "Job not found" }, 404);
  return c.json({
    ok: true,
    jobId: job.id,
    status: job.status,
    phase: job.phase,
    score: job.score,
    logs: safeJsonArray(job.logs_json).map(String),
  });
});

jobsRoutes.post("/:id/step", async (c) => {
  if (!c.env.DB) return c.json({ ok: false, error: "D1 DB binding missing" }, 500);
  const id = c.req.param("id");
  const existing = await getPersistentJob(c.env.DB, id);
  if (!existing) return c.json({ ok: false, error: "Job not found" }, 404);

  const claimed = await claimExecution(c.env.DB, id);
  if (!claimed) {
    return c.json({ ok: false, error: "Job is already executing. Refresh and retry after the current step." }, 409);
  }

  const job = await runPersistentJobStep(c.env, id);
  return c.json({ ok: true, job: publicJob(job) });
});

jobsRoutes.post("/:id/resume", async (c) => {
  if (!c.env.DB) return c.json({ ok: false, error: "D1 DB binding missing" }, 500);
  const id = c.req.param("id");
  const existing = await getPersistentJob(c.env.DB, id);
  if (!existing) return c.json({ ok: false, error: "Job not found" }, 404);

  const job = await resumePersistentJob(c.env.DB, id);
  const claimed = await claimExecution(c.env.DB, id);
  if (claimed) scheduleExecution(c, id);

  return c.json({
    ok: true,
    job: publicJob(job),
    execution: claimed ? "background" : "already_running",
  }, 202);
});

jobsRoutes.post("/:id/improve", async (c) => {
  if (!c.env.DB) return c.json({ ok: false, error: "D1 DB binding missing" }, 500);
  const id = c.req.param("id");
  const job = await getPersistentJob(c.env.DB, id);
  if (!job) return c.json({ ok: false, error: "Job not found" }, 404);

  enableInfiniteImprovement(job);
  await savePersistentJob(c.env.DB, job);

  const claimed = await claimExecution(c.env.DB, id);
  if (claimed) scheduleExecution(c, id);

  return c.json({
    ok: true,
    job: publicJob(job),
    execution: claimed ? "background" : "already_running",
  }, 202);
});

jobsRoutes.get("/:id/files", async (c) => {
  if (!c.env.DB) return c.json({ ok: false, error: "D1 DB binding missing" }, 500);
  const job = await getPersistentJob(c.env.DB, c.req.param("id"));
  if (!job) return c.json({ ok: false, error: "Job not found" }, 404);
  return c.json({
    ok: true,
    jobId: job.id,
    files: safeJsonArray(job.files_json),
    phase: job.phase,
    score: job.score,
    status: job.status,
  });
});

jobsRoutes.get("/:id/report", async (c) => {
  if (!c.env.DB) return c.json({ ok: false, error: "D1 DB binding missing" }, 500);
  const job = await getPersistentJob(c.env.DB, c.req.param("id"));
  if (!job) return c.json({ ok: false, error: "Job not found" }, 404);

  const files = safeJsonArray(job.files_json);
  const build = virtualBuildCheck(files);
  const score = scoreProject(files);
  const report = createAutonomousReport({
    job,
    files,
    build,
    score,
    targetProfile: getTargetProfile(job.target),
  });

  return c.json({ ok: true, report });
});

async function startJob(c: any) {
  if (!c.env.DB) return c.json({ ok: false, error: "D1 DB binding missing" }, 500);
  const body = await c.req.json().catch(() => null);
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) return c.json({ ok: false, error: "Missing prompt" }, 400);

  const job = await createPersistentJob(c.env.DB, { prompt, target: body?.target });
  const claimed = await claimExecution(c.env.DB, job.id);
  if (claimed) scheduleExecution(c, job.id);

  return c.json({
    ok: true,
    jobId: job.id,
    job: publicJob(job),
    execution: claimed ? "background" : "scheduled",
  }, 202);
}

function scheduleExecution(c: any, id: string) {
  c.executionCtx.waitUntil(
    runPersistentJobStep(c.env, id).catch((error: unknown) => {
      console.error("Background job execution failed", id, error);
    })
  );
}

async function claimExecution(db: D1Database, id: string) {
  const now = Date.now();
  const result = await db
    .prepare(
      `UPDATE jobs
       SET next_run_at = ?, updated_at = ?
       WHERE id = ?
         AND NOT (next_run_at > ? AND updated_at > ?)`
    )
    .bind(now + EXECUTION_LEASE_MS, now, id, now, now - EXECUTION_LEASE_MS)
    .run();

  return Boolean(result.meta.changes);
}

function enableInfiniteImprovement(job: PersistentJob) {
  job.status = "running";
  job.error = "";
  job.next_run_at = Date.now();
  if (job.phase === "done") job.phase = "core_features";
  if (!/auto\s*improve\s*forever\s*:\s*true/i.test(job.prompt)) {
    job.prompt = [job.prompt.trim(), "", "auto improve forever: true"].join("\n");
  }
  job.max_attempts = Math.max(Number(job.max_attempts || 12), 999999);
  job.strategy = "force_product_depth";
  appendJobLog(job, "Manual infinite improvement requested.");
}
