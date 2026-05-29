import { Hono } from "hono";

import type { Env } from "../core/types";

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

export const jobsRoutes = new Hono<{

Bindings: Env;

}>();

jobsRoutes.get("/", async (c) => {

if (!c.env.DB) {

return c.json({ ok: false, error: "D1 DB binding missing" }, 500);

}

const jobs = await listPersistentJobs(c.env.DB);

return c.json({

ok: true,

jobs,

});

});

jobsRoutes.post("/create", async (c) => {

if (!c.env.DB) {

return c.json({ ok: false, error: "D1 DB binding missing" }, 500);

}

const body = await c.req.json().catch(() => null);

if (!body?.prompt || typeof body.prompt !== "string") {

return c.json({ ok: false, error: "Missing prompt" }, 400);

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

jobsRoutes.post("/autonomous", async (c) => {

if (!c.env.DB) {

return c.json({ ok: false, error: "D1 DB binding missing" }, 500);

}

const body = await c.req.json().catch(() => null);

if (!body?.prompt || typeof body.prompt !== "string") {

return c.json({ ok: false, error: "Missing prompt" }, 400);

}

try {

const job = await createPersistentJob(c.env.DB, {

prompt: body.prompt,

target: body.target,

});

const updatedJob = await runPersistentJobStep(c.env, job.id);

return c.json({

ok: true,

jobId: updatedJob.id,

job: publicJob(updatedJob),

});

} catch (error: any) {

return c.json(

{

ok: false,

error: error?.message || "Autonomous job failed",

},

500

);

}

});

jobsRoutes.get("/:id", async (c) => {

if (!c.env.DB) {

return c.json({ ok: false, error: "D1 DB binding missing" }, 500);

}

const job = await getPersistentJob(c.env.DB, c.req.param("id"));

if (!job) {

return c.json({ ok: false, error: "Job not found" }, 404);

}

return c.json(publicJob(job));

});

jobsRoutes.get("/:id/logs", async (c) => {

if (!c.env.DB) {

return c.json({ ok: false, error: "D1 DB binding missing" }, 500);

}

const job = await getPersistentJob(c.env.DB, c.req.param("id"));

if (!job) {

return c.json({ ok: false, error: "Job not found" }, 404);

}

const logs = safeJsonArray(job.logs_json).map(String);

return c.json({

ok: true,

jobId: job.id,

status: job.status,

phase: job.phase,

score: job.score,

logs,

});

});

jobsRoutes.post("/:id/step", async (c) => {

if (!c.env.DB) {

return c.json({ ok: false, error: "D1 DB binding missing" }, 500);

}

const job = await runPersistentJobStep(c.env, c.req.param("id"));

return c.json({

ok: true,

job: publicJob(job),

});

});

jobsRoutes.post("/:id/resume", async (c) => {

if (!c.env.DB) {

return c.json({ ok: false, error: "D1 DB binding missing" }, 500);

}

const job = await resumePersistentJob(c.env.DB, c.req.param("id"));

c.executionCtx.waitUntil(runPersistentJobStep(c.env, job.id));

return c.json({

ok: true,

job: publicJob(job),

});

});

jobsRoutes.post("/:id/improve", async (c) => {

if (!c.env.DB) {

return c.json({ ok: false, error: "D1 DB binding missing" }, 500);

}

const job = await getPersistentJob(c.env.DB, c.req.param("id"));

if (!job) {

return c.json({ ok: false, error: "Job not found" }, 404);

}

job.status = "running";

job.error = "";

job.next_run_at = Date.now();

if (job.phase === "done") {

job.phase = "core_features";

}

if (!/auto\s*improve\s*forever\s*:\s*true/i.test(job.prompt)) {

job.prompt = [job.prompt.trim(), "", "auto improve forever: true"].join("\n");

}

job.max_attempts = Math.max(Number(job.max_attempts || 12), 999999);

job.strategy = "force_product_depth";

appendJobLog(job, "Manual infinite improvement requested.");

await savePersistentJob(c.env.DB, job);

c.executionCtx.waitUntil(runPersistentJobStep(c.env, job.id));

return c.json({

ok: true,

job: publicJob(job),

});

});

jobsRoutes.get("/:id/files", async (c) => {

if (!c.env.DB) {

return c.json({ ok: false, error: "D1 DB binding missing" }, 500);

}

const job = await getPersistentJob(c.env.DB, c.req.param("id"));

if (!job) {

return c.json({ ok: false, error: "Job not found" }, 404);

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

return c.json({ ok: false, error: "D1 DB binding missing" }, 500);

}

const job = await getPersistentJob(c.env.DB, c.req.param("id"));

if (!job) {

return c.json({ ok: false, error: "Job not found" }, 404);

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
