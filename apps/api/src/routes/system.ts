import { Hono } from "hono";

import type { Env } from "../core/types";

import { callGemini } from "../core/ai";
import { cleanFiles } from "../core/files";

import {
  applyDependencyResolution,
  resolveDependencies,
  virtualBuildCheck,
} from "../core/build";

import { scoreProject } from "../core/scoring";
import { inspectProject } from "../core/inspect";

import {
  createDeploymentPack,
  listTemplates,
} from "../core/templates";

import { createPublishReport } from "../core/reports";

import {
  addProjectMemory,
  clearProjectMemory,
  getProjectMemory,
} from "../core/memory";

export const systemRoutes = new Hono<{
  Bindings: Env;
}>();

systemRoutes.get("/health", (c) =>
  c.json({
    ok: true,
    service: "AutoApp API",
    runtime: "cloudflare-workers",
    timestamp: Date.now(),
  })
);

systemRoutes.get("/ai/test", async (c) => {
  try {
    const result = await callGemini(
      c.env,
      {
        model: c.env.DEFAULT_GEMINI_MODEL || "gemini-2.5-flash",
      },
      'Return ONLY this JSON: {"ok":true,"message":"Gemini ready"}'
    );

    return c.json({
      ok: true,
      provider: "gemini",
      result,
    });
  } catch (error: any) {
    return c.json(
      {
        ok: false,
        provider: "gemini",
        error: error?.message || "Gemini test failed",
      },
      500
    );
  }
});

systemRoutes.post("/build/check", async (c) => {
  const body = await c.req.json().catch(() => null);

  return c.json(
    virtualBuildCheck(
      cleanFiles(body?.files || [])
    )
  );
});

systemRoutes.post("/score", async (c) => {
  const body = await c.req.json().catch(() => null);

  return c.json({
    ok: true,
    score: scoreProject(
      cleanFiles(body?.files || [])
    ),
  });
});

systemRoutes.post("/inspect", async (c) => {
  const body = await c.req.json().catch(() => null);

  return c.json({
    ok: true,
    inspection: inspectProject(
      cleanFiles(body?.files || [])
    ),
  });
});

systemRoutes.post("/dependencies/resolve", async (c) => {
  const body = await c.req.json().catch(() => null);
  const files = cleanFiles(body?.files || []);
  const resolution = resolveDependencies(files);

  return c.json({
    ok: true,
    resolution,
    files: body?.apply
      ? applyDependencyResolution(files, resolution.packageJson)
      : undefined,
  });
});

systemRoutes.get("/templates", (c) =>
  c.json({
    ok: true,
    templates: listTemplates(),
  })
);

systemRoutes.post("/templates/apply", async (c) => {
  const body = await c.req.json().catch(() => null);

  const template = listTemplates().find(
    (item) => item.id === body?.id
  );

  if (!template) {
    return c.json(
      {
        ok: false,
        error: "Template not found",
      },
      404
    );
  }

  return c.json({
    ok: true,
    template,
  });
});

systemRoutes.post("/deployment/pack", async (c) => {
  const body = await c.req.json().catch(() => null);
  const files = cleanFiles(body?.files || []);
  const additions = createDeploymentPack(files);

  return c.json({
    ok: true,
    files: additions,
    count: additions.length,
  });
});

systemRoutes.post("/publish/report", async (c) => {
  const body = await c.req.json().catch(() => null);
  const files = cleanFiles(body?.files || []);

  return c.json({
    ok: true,
    report: createPublishReport(files),
  });
});

systemRoutes.get("/memory/:projectId", async (c) => {
  const memory = await getProjectMemory(
    c.env,
    c.req.param("projectId")
  );

  return c.json({
    ok: true,
    memory,
  });
});

systemRoutes.post("/memory/:projectId", async (c) => {
  const body = await c.req.json().catch(() => null);

  const row = await addProjectMemory(c.env, {
    projectId: c.req.param("projectId"),
    type: body?.type || "general",
    content: body?.content || {},
  });

  return c.json({
    ok: true,
    row,
  });
});

systemRoutes.delete("/memory/:projectId", async (c) => {
  const result = await clearProjectMemory(
    c.env,
    c.req.param("projectId")
  );

  return c.json(result);
});

systemRoutes.post("/preview/start", async (c) =>
  c.json(
    {
      ok: false,
      error: "Real preview is not configured.",
      required:
        "Connect a real preview provider such as Cloudflare Pages deployment, StackBlitz WebContainer, CodeSandbox, or a real build server.",
    },
    501
  )
);

systemRoutes.get("/preview/:id", (c) =>
  c.json(
    {
      ok: false,
      error: "Real preview is not configured.",
      previewId: c.req.param("id"),
    },
    501
  )
);

systemRoutes.delete("/preview/:id", (c) =>
  c.json(
    {
      ok: false,
      error: "No real preview session exists.",
      previewId: c.req.param("id"),
    },
    501
  )
);
