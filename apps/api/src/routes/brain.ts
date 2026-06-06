import { Hono } from "hono";

import type { Env, VirtualFile } from "../core/types";
import { createCompanyBrain } from "../core/companyBrain";

export const brainRoutes = new Hono<{ Bindings: Env }>();

brainRoutes.post("/analyze", async (c) => {
  const body = await c.req.json().catch(() => ({}));

  const brain = createCompanyBrain({
    prompt: String(body.prompt || ""),
    files: normalizeFiles(body.files),
    buildOk: Boolean(body.buildOk),
    previousMemory: body.previousMemory || null,
  });

  return c.json({
    ok: true,
    brain,
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
  
