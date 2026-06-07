import { Hono } from "hono";

import type { Env, VirtualFile } from "../core/types";

import {
  createProfessionalPipelineContext,
  applyProfessionalPostProcess,
  chooseProfessionalFocus,
} from "../core/pipeline";

import { runQualityGate } from "../core/qualityGate";

export const pipelineRoutes = new Hono<{ Bindings: Env }>();

pipelineRoutes.post("/plan", async (c) => {
  const body = await c.req.json().catch(() => ({}));

  const prompt = String(body.prompt || "");
  const files = normalizeFiles(body.files);

  const context = createProfessionalPipelineContext({
    prompt,
    files,
  });

  return c.json({
    ok: true,
    productPlan: context.productPlan,
    architecturePlan: context.architecturePlan,
    designSystem: context.designSystem,
    quality: context.quality,
    promptContext: context.promptContext,
  });
});

pipelineRoutes.post("/quality", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const files = normalizeFiles(body.files);

  const quality = runQualityGate(files);

  return c.json({
    ok: true,
    quality,
    focus: chooseProfessionalFocus(quality),
  });
});

pipelineRoutes.post("/autofix", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const files = normalizeFiles(body.files);

  const result = applyProfessionalPostProcess({
    files,
    includeTests: Boolean(body.includeTests),
  });

  return c.json({
    ok: true,
    files: result.files,
    quality: result.quality,
    changes: result.changes,
    focus: chooseProfessionalFocus(result.quality),
  });
});

function normalizeFiles(value: unknown): VirtualFile[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((file: any) => file && typeof file.path === "string")
    .map((file: any) => ({
      path: normalizePath(file.path),
      content:
        file.content === null || typeof file.content === "string"
          ? file.content
          : String(file.content || ""),
    }));
}

function normalizePath(path: string) {
  const value = String(path || "").trim();
  return value.startsWith("/") ? value : "/" + value;
                    }
        
