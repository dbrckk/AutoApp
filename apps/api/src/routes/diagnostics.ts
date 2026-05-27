import { Hono } from "hono";

import type { Env } from "../core/types";
import { callAiJson } from "../core/ai";
import { listAgents } from "../agents/registry";
import { testGitHubAccess } from "./github";

export const diagnosticsRoutes = new Hono<{ Bindings: Env }>();

diagnosticsRoutes.get("/", async (c) => {
  const d1 = await checkD1(c.env);
  const github = checkGitHub(c.env);
  const ai = checkAi(c.env);

  return c.json({
    ok: true,
    service: "AutoApp API",
    runtime: "cloudflare-workers",
    timestamp: Date.now(),
    realCapabilities: {
      aiGeneration: ai.configured ? "real" : "not_configured",
      d1Jobs: d1.status === "connected" ? "real" : d1.status,
      d1Memory: d1.status === "connected" ? "real" : d1.status,
      cronResume: "real_if_cron_deployed",
      githubExport: github.configured ? "real" : "not_configured",
      staticBuildCheck: "static_only",
      dependencyResolution: "static_only",
      preview: "not_configured",
      realNpmBuild: "not_configured",
      apkBuild: "not_supported_on_cloudflare_worker",
    },
    checks: {
      d1,
      github,
      ai,
      agents: listAgents().map((agent) => ({
        role: agent.role,
        name: agent.name,
      })),
      routes: [
        "GET /api/health",
        "GET /api/diagnostics",
        "GET /api/diagnostics/live",
        "GET /api/diagnostics/github?repo=OWNER/REPO",
        "POST /api/generate",
        "POST /api/generate-job",
        "POST /api/autopilot/run",
        "GET /api/jobs",
        "POST /api/jobs/create",
        "POST /api/jobs/autonomous",
        "POST /api/jobs/:id/step",
        "POST /api/jobs/:id/resume",
        "GET /api/jobs/:id/files",
        "GET /api/jobs/:id/report",
        "POST /api/github/export",
        "POST /api/github/test-export",
        "GET /api/github/latest?repo=OWNER/REPO",
        "GET /api/github/file?repo=OWNER/REPO&path=.autoapp-test.json",
        "GET /api/templates",
        "POST /api/score",
        "POST /api/build/check",
        "POST /api/dependencies/resolve",
      ],
    },
  });
});

diagnosticsRoutes.get("/live", async (c) => {
  const d1 = await checkD1(c.env);
  const github = checkGitHub(c.env);
  const ai = checkAi(c.env);

  let aiLive: any = {
    ok: false,
    error: "AI provider not configured",
  };

  if (ai.configured) {
    try {
      const result = await callAiJson(
        c.env,
        {},
        'Return ONLY this JSON: {"ok":true,"message":"AI live test passed"}'
      );

      aiLive = {
        ok: true,
        result,
      };
    } catch (error: any) {
      aiLive = {
        ok: false,
        error: error?.message || "AI live test failed",
      };
    }
  }

  return c.json({
    ok: true,
    service: "AutoApp API",
    runtime: "cloudflare-workers",
    timestamp: Date.now(),
    live: {
      d1,
      github,
      ai,
      aiLive,
    },
  });
});

diagnosticsRoutes.get("/github", async (c) => {
  const repo = c.req.query("repo");
  const branch = c.req.query("branch") || "main";

  if (!repo) {
    return c.json(
      {
        ok: false,
        error: "Missing repo query. Example: /api/diagnostics/github?repo=owner/repo",
      },
      400
    );
  }

  if (!c.env.GITHUB_TOKEN) {
    return c.json(
      {
        ok: false,
        error: "Missing GITHUB_TOKEN secret.",
      },
      400
    );
  }

  try {
    const result = await testGitHubAccess({
      token: c.env.GITHUB_TOKEN,
      repo,
      branch,
    });

    return c.json(result);
  } catch (error: any) {
    return c.json(
      {
        ok: false,
        error: error?.message || "GitHub live test failed",
      },
      500
    );
  }
});

async function checkD1(env: Env) {
  if (!env.DB) {
    return {
      status: "missing",
      error: "DB binding missing",
    };
  }

  try {
    await env.DB.prepare("SELECT 1").first();

    return {
      status: "connected",
      binding: "DB",
    };
  } catch (error: any) {
    return {
      status: "error",
      error: error?.message || "D1 check failed",
    };
  }
}

function checkGitHub(env: Env) {
  return {
    configured: Boolean(env.GITHUB_TOKEN),
    token: env.GITHUB_TOKEN ? "present" : "missing",
    export: env.GITHUB_TOKEN ? "real" : "not_configured",
  };
}

function checkAi(env: Env) {
  const provider = env.DEFAULT_AI_PROVIDER || "groq";

  const providers = {
    groq: {
      configured: Boolean(env.GROQ_API_KEY),
      model: env.DEFAULT_GROQ_MODEL || "llama-3.3-70b-versatile",
    },
    gemini: {
      configured: Boolean(env.GEMINI_API_KEY),
      model: env.DEFAULT_GEMINI_MODEL || "gemini-2.5-flash",
    },
    openai: {
      configured: Boolean(env.OPENAI_API_KEY),
      model: env.DEFAULT_OPENAI_MODEL || "gpt-4o-mini",
    },
  };

  const selected =
    providers[provider as keyof typeof providers] || providers.groq;

  return {
    provider,
    configured: selected.configured,
    model: selected.model,
    providers,
  };
        }
