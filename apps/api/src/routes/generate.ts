import { Hono } from "hono";

import type { Env } from "../core/types";

import { cleanFiles } from "../core/files";
import { generateProject } from "../core/generate";

export const generateRoutes = new Hono<{
  Bindings: Env;
}>();

generateRoutes.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);

  if (!body?.prompt || typeof body.prompt !== "string") {
    return c.json({ error: "Missing required field: prompt" }, 400);
  }

  const result = await generateProject({
    env: c.env,
    prompt: body.prompt,
    files: cleanFiles(body.currentFiles || []),
    aiConfig: body.aiConfig || {},
    buildMode: body.buildMode || "virtual",
    isAutoImprove: Boolean(body.isAutoImprove),
  });

  return c.json(result);
});
