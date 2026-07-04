import { Hono } from "hono";
import type { Env } from "../core/types";
import { createPersistentJob, publicJob, runPersistentJobStep } from "../core/jobs";

export const jobStartRoutes = new Hono<{ Bindings: Env }>();

jobStartRoutes.post("/autonomous", async (c) => {
  if (!c.env.DB) return c.json({ ok: false, error: "D1 DB binding missing" }, 500);

  const body = await c.req.json().catch(() => null);
  if (!body?.prompt || typeof body.prompt !== "string" || !body.prompt.trim()) {
    return c.json({ ok: false, error: "Missing prompt" }, 400);
  }

  const job = await createPersistentJob(c.env.DB, {
    prompt: body.prompt.trim(),
    target: body.target,
  });

  c.executionCtx.waitUntil(runPersistentJobStep(c.env, job.id));

  return c.json({
    ok: true,
    jobId: job.id,
    job: publicJob(job),
  });
});
