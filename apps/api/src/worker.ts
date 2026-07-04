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
const ALLOWED_GITHUB_OWNER = "dbrckk";

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

  if (isRepositorySensitivePath(c.req.path)) {
    const repo = await readRequestedRepo(c);
    if (repo && !isAllowedRepo(repo)) {
      return c.json({ ok: false, error: `Repository owner is not allowed: ${repo}` }, 403);
    }
  }

  await next();
});

app.get("/api/healthz", (c) => {
  return c.json({
    ok: true,
    service: "AutoApp API",
    version: "autoapp-autonomous-runtime-v2",
    timestamp: Date.now(),
    githubOwnerRestriction: ALLOWED_GITHUB_OWNER,
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

function isRepositorySensitivePath(path: string) {
  return path.startsWith("/api/github/") ||
    path === "/api/diagnostics/github" ||
    path === "/api/jobs/create" ||
    path === "/api/jobs/autonomous";
}

async function readRequestedRepo(c: any) {
  const queryRepo = c.req.query("repo");
  if (queryRepo) return String(queryRepo).trim();
  if (c.req.method === "GET") return "";

  const body = await c.req.raw.clone().json().catch(() => null);
  if (typeof body?.repo === "string") return body.repo.trim();
  if (typeof body?.prompt === "string") {
    const match = body.prompt.match(/github\s*repo\s*:\s*([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+)/i);
    return match?.[1] || "";
  }
  return "";
}

function isAllowedRepo(repo: string) {
  const owner = String(repo).trim().split("/")[0]?.toLowerCase();
  return owner === ALLOWED_GITHUB_OWNER.toLowerCase();
}
