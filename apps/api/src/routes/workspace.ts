import { Hono } from "hono";

import type { Env, VirtualFile } from "../core/types";
import { createLiveWorkspaceSnapshot } from "../core/liveWorkspace";

export const workspaceRoutes = new Hono<{ Bindings: Env }>();

workspaceRoutes.post("/snapshot", async (c) => {
  const body = await c.req.json().catch(() => ({}));

  const snapshot = createLiveWorkspaceSnapshot({
    prompt: String(body.prompt || ""),
    files: normalizeFiles(body.files),
    previousFiles: normalizeFiles(body.previousFiles),
    selectedPath: body.selectedPath ? String(body.selectedPath) : undefined,
    buildOk: Boolean(body.buildOk),
  });

  return c.json({
    ok: true,
    snapshot,
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
