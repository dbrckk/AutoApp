import { Hono } from "hono";
import { cors } from "hono/cors";

import type { Env } from "./core/types";

import { jobsRoutes } from "./routes/jobs";
import { generateRoutes } from "./routes/generate";
import { systemRoutes } from "./routes/system";
import { asyncRoutes, getMemoryJob } from "./routes/async";

import { runScheduledJobs } from "./core/jobs";

const app = new Hono<{
  Bindings: Env;
}>();

app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  })
);

app.get("/api/jobs/:id", async (c, next) => {
  const memoryJob = getMemoryJob(c.req.param("id"));

  if (memoryJob) {
    return c.json(memoryJob);
  }

  return next();
});

app.route("/api/jobs", jobsRoutes);
app.route("/api/generate", generateRoutes);
app.route("/api", asyncRoutes);
app.route("/api", systemRoutes);

app.notFound((c) =>
  c.json(
    {
      ok: false,
      error: "Route not found",
      path: c.req.path,
    },
    404
  )
);

app.onError((error, c) =>
  c.json(
    {
      ok: false,
      error: error?.message || "Worker error",
    },
    500
  )
);

export default {
  fetch: app.fetch,

  async scheduled(
    event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext
  ) {
    ctx.waitUntil(runScheduledJobs(env));
  },
};
