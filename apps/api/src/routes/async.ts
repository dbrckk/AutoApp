import { Hono } from "hono";

import type { Env, MemoryJob } from "../core/types";
import { cleanFiles, mergeFiles } from "../core/files";
import { generateProject } from "../core/generate";

const memoryJobs = new Map<string, MemoryJob>();

export const asyncRoutes = new Hono<{ Bindings: Env }>();

asyncRoutes.post("/generate-job", async (c) => {
  const body = await c.req.json().catch(() => null);
  const job = createMemoryJob();

  c.executionCtx.waitUntil(
    runMemoryJob(job.id, async () => {
      if (!body?.prompt) throw new Error("Missing required field: prompt");

      return generateProject({
        env: c.env,
        prompt: body.prompt,
        files: cleanFiles(body.currentFiles || []),
        aiConfig: body.aiConfig || {},
        buildMode: body.buildMode || "virtual",
        isAutoImprove: Boolean(body.isAutoImprove),
      });
    })
  );

  return c.json({ ok: true, jobId: job.id });
});

asyncRoutes.post("/autopilot/run", async (c) => {
  const body = await c.req.json().catch(() => null);
  const job = createMemoryJob();

  c.executionCtx.waitUntil(
    runMemoryJob(job.id, async () => {
      let files = cleanFiles(body?.files || []);
      const iterations: any[] = [];
      const logs: string[] = [];

      const maxIterations = Math.max(1, Math.min(5, Number(body?.maxIterations || 3)));
      const targetScore = Number(body?.targetScore || 90);

      for (let index = 1; index <= maxIterations; index++) {
        const previousScore = iterations.at(-1)?.score?.total || 0;
        if (previousScore >= targetScore) break;

        logs.unshift(`${new Date().toISOString()} · Autopilot iteration ${index}`);

        const result = await generateProject({
          env: c.env,
          prompt: `${body?.prompt || "Improve this project."}\n\nImprove this project. Keep it buildable. Return changed files only.`,
          files,
          aiConfig: body?.aiConfig || {},
          buildMode: body?.buildMode || "virtual",
          isAutoImprove: true,
        });

        iterations.push(result);
        files = mergeFiles(files, result.files || []);

        if ((result.score?.total || 0) >= targetScore) break;
      }

      return {
        files,
        iterations,
        finalScore: iterations.at(-1)?.score?.total || 0,
        reachedTarget: (iterations.at(-1)?.score?.total || 0) >= targetScore,
        logs,
      };
    })
  );

  return c.json({ ok: true, jobId: job.id });
});

export function getMemoryJob(id: string) {
  return memoryJobs.get(id) || null;
}

function createMemoryJob(): MemoryJob {
  const job: MemoryJob = {
    id: crypto.randomUUID(),
    status: "queued",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    logs: [],
  };

  memoryJobs.set(job.id, job);
  return job;
}

async function runMemoryJob(jobId: string, task: () => Promise<unknown>) {
  updateMemoryJob(jobId, { status: "running" });

  try {
    const result = await task();
    updateMemoryJob(jobId, { status: "success", result });
  } catch (error: any) {
    updateMemoryJob(jobId, {
      status: "error",
      error: error?.message || "Job failed",
    });
  }
}

function updateMemoryJob(id: string, patch: Partial<MemoryJob>) {
  const job = memoryJobs.get(id);
  if (!job) return;

  memoryJobs.set(id, {
    ...job,
    ...patch,
    updatedAt: Date.now(),
  });
                 }
