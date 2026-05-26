import { Hono } from "hono";

import type { Env } from "../core/types";
import { listAgents } from "../agents/registry";

export const diagnosticsRoutes = new Hono<{ Bindings: Env }>();

diagnosticsRoutes.get("/", async (c) => {
  let d1Status = "missing";
  let d1Error = "";

  if (c.env.DB) {
    try {
      await c.env.DB.prepare("SELECT 1").first();
      d1Status = "connected";
    } catch (error: any) {
      d1Status = "error";
      d1Error = error?.message || "D1 check failed";
    }
  }

  return c.json({
    ok: true,
    service: "AutoApp API",
    runtime: "cloudflare-workers",
    timestamp: Date.now(),
    checks: {
      d1: d1Status,
      d1Error,
      geminiConfigured: Boolean(c.env.GEMINI_API_KEY),
      defaultProvider: c.env.DEFAULT_AI_PROVIDER || "gemini",
      defaultGeminiModel: c.env.DEFAULT_GEMINI_MODEL || "gemini-2.5-flash",
      agents: listAgents().map((agent) => agent.role),
      routes: [
        "/api/health",
        "/api/diagnostics",
        "/api/generate",
        "/api/generate-job",
        "/api/autopilot/run",
        "/api/jobs",
        "/api/templates",
        "/api/score",
        "/api/build/check",
      ],
    },
  });
});
