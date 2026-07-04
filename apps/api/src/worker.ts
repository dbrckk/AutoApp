import { Hono } from "hono";
import { cors } from "hono/cors";

import type { Env } from "./core/types";
import { ensureAppSchema } from "./core/schema";
import { runEligibleScheduledJobs } from "./core/scheduler";

import { jobsRoutes } from "./routes/jobs";
import { generateRoutes } from "./routes/generate";
import { systemRoutes } from "./routes/system";
import { asyncRoutes, getMemoryJob } from "./routes/async";
import { diagnosticsRoutes } from "./routes/diagnostics";
import { githubRoutes } from "./routes/github";
import { pipelineRoutes } from "./routes/pipeline";
import { brainRoutes } from "./routes/brain";
import { workspaceRoutes } from "./routes/workspace";

const app = new Hono<{ Bindings: Env }>();

app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    exposeHeaders: ["Content-Length"],
    maxAge: 86400,
  })
);

app.use("/api/*", async (c, next) => {
  if (c.req.path !== "/api/healthz") {
    const schema = await ensureAppSchema(c.env);
    if (!schema.ok) return c.json({ ok: false, error: schema.error || "D1 schema unavailable" }, 503);
  }
  await next();
});

app.get("/api/healthz", (c) => {
  return c.json({
    ok: true,
    service: "AutoApp API",
    version: "autoapp-autonomous-runtime-v2",
    timestamp: Date.now(),
    routes: {
      jobs: true,
      generate: true,
      async: true,
      system: true,
      diagnostics: true,
      github: true,
      pipeline: true,
      brain: true,
      workspace: true,
    },
  });
});

app.get("/api/jobs/:id", async (c, next) => {
  const memoryJob = getMemoryJob(c.req.param("id"));
  if (memoryJob) return c.json(memoryJob);
  return next();
});

app.route("/api/jobs", jobsRoutes);
app.route("/api/generate", generateRoutes);
app.route("/api", asyncRoutes);
app.route("/api", systemRoutes);
app.route("/api/diagnostics", diagnosticsRoutes);
app.route("/api/github", githubRoutes);
app.route("/api/pipeline", pipelineRoutes);
app.route("/api/brain", brainRoutes);
app.route("/api/workspace", workspaceRoutes);

app.notFound((c) => {
  return c.json(
    {
      ok: false,
      error: "Route not found",
      path: c.req.path,
      method: c.req.method,
      availableRoutes: [
        "GET /api/healthz",
        "POST /api/generate",
        "GET /api/jobs",
        "POST /api/jobs/create",
        "POST /api/jobs/autonomous",
        "GET /api/jobs/:id",
        "POST /api/jobs/:id/step",
        "POST /api/jobs/:id/improve",
        "POST /api/jobs/:id/resume",
        "DELETE /api/jobs/:id",
        "GET /api/jobs/:id/files",
        "GET /api/jobs/:id/logs",
        "GET /api/jobs/:id/report",
        "POST /api/pipeline/plan",
        "POST /api/pipeline/quality",
        "POST /api/pipeline/autofix",
        "POST /api/brain/analyze",
        "POST /api/workspace/snapshot",
        "POST /api/github/export",
        "GET /api/diagnostics",
      ],
    },
    404
  );
});

app.onError((error, c) => {
  console.error("AutoApp worker error:", error);
  return c.json(
    {
      ok: false,
      error: error?.message || "Worker error",
      path: c.req.path,
      method: c.req.method,
      timestamp: Date.now(),
    },
    500
  );
});

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runEligibleScheduledJobs(env));
  },
};
