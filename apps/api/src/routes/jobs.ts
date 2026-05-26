import { Hono } from "hono";

import type { Env } from "../core/types";

import {
  createPersistentJob,
  getPersistentJob,
  listPersistentJobs,
  publicJob,
  resumePersistentJob,
  runPersistentJobStep,
} from "../core/jobs";

import { safeJsonArray } from "../core/files";
import { virtualBuildCheck } from "../core/build";
import { scoreProject } from "../core/scoring";
import { getTargetProfile } from "../core/targets";
import { createAutonomousReport } from "../core/reports";

export const jobsRoutes = new Hono<{
  Bindings: Env;
}>();

jobsRoutes.get("/", async (c) => {
  if (!c.env.DB) {
    return c.json({ error: "D1 DB binding missing" }, 500);
  }

  const jobs = await listPersistentJobs(c.env.DB);

  return c.json({
    ok: true,
    jobs,
  });
});

jobsRoutes.post("/create", async (c) => {
  if (!c.env.DB) {
    return c.json({ error: "D1 DB binding missing" }, 500);
  }

  const body = await c.req.json().catch(() => null);

  if (!body?.prompt || typeof body.prompt !== "string") {
    return c.json({ error: "Missing prompt" }, 400);
  }

  const job = await createPersistentJob(c.env.DB, {
    prompt: body.prompt,
    target: body.target,
  });

  c.executionCtx.waitUntil(runPersistentJobStep(c.env, job.id));

  return c.json({
    ok: true,
    jobId: job.id,
    job: publicJob(job),
  });
});

jobsRoutes.get("/:id", async (c) => {
  if (!c.env.DB) {
    return c.json({ error: "D1 DB binding missing" }, 500);
  }

  const job = await getPersistentJob(c.env.DB, c.req.param("id"));

  if (!job) {
    return c.json({ error: "Job not found" }, 404);
  }

  return c.json(publicJob(job));
});

jobsRoutes.post("/:id/step", async (c) => {
  if (!c.env.DB) {
    return c.json({ error: "D1 DB binding missing" }, 500);
  }

  const job = await runPersistentJobStep(c.env, c.req.param("id"));

  return c.json({
    ok: true,
    job: publicJob(job),
  });
});

jobsRoutes.post("/:id/resume", async (c) => {
  if (!c.env.DB) {
    return c.json({ error: "D1 DB binding missing" }, 500);
  }

  const job = await resumePersistentJob(c.env.DB, c.req.param("id"));

  c.executionCtx.waitUntil(runPersistentJobStep(c.env, job.id));

  return c.json({
    ok: true,
    job: publicJob(job),
  });
});

jobsRoutes.get("/:id/files", async (c) => {
  if (!c.env.DB) {
    return c.json({ error: "D1 DB binding missing" }, 500);
  }

  const job = await getPersistentJob(c.env.DB, c.req.param("id"));

  if (!job) {
    return c.json({ error: "Job not found" }, 404);
  }

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
  if (!c.env.DB) {
    return c.json({ error: "D1 DB binding missing" }, 500);
  }

  const job = await getPersistentJob(c.env.DB, c.req.param("id"));

  if (!job) {
    return c.json({ error: "Job not found" }, 404);
  }

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

  return c.json({
    ok: true,
    report,
  });
});
