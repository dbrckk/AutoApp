import "dotenv/config";

import express from "express";
import path from "path";
import { fileURLToPath } from "url";

import { orchestrateGeneration } from "./src/core/engine/orchestration";
import { createAiCaller } from "./src/core/ai/provider";
import type { VirtualFile } from "./src/core/engine/types";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(express.json({ limit: "50mb" }));

type JobStatus = "queued" | "running" | "success" | "error";

type Job = {
  id: string;
  status: JobStatus;
  createdAt: number;
  updatedAt: number;
  logs: string[];
  result?: any;
  error?: string;
};

const jobs = new Map<string, Job>();

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function now() {
  return Date.now();
}

function createJob() {
  const job: Job = {
    id: uid(),
    status: "queued",
    createdAt: now(),
    updatedAt: now(),
    logs: [],
  };

  jobs.set(job.id, job);

  return job;
}

function updateJob(id: string, patch: Partial<Job>) {
  const current = jobs.get(id);

  if (!current) return null;

  const updated: Job = {
    ...current,
    ...patch,
    updatedAt: now(),
  };

  jobs.set(id, updated);

  return updated;
}

function pushJobLog(id: string, message: string) {
  const current = jobs.get(id);

  if (!current) return;

  current.logs.unshift(
    `${new Date().toISOString()} · ${message}`
  );

  current.logs = current.logs.slice(0, 200);

  current.updatedAt = now();

  jobs.set(id, current);
}

function cleanupOldJobs(maxAgeMs = 1000 * 60 * 60) {
  const currentTime = now();

  for (const [id, job] of jobs.entries()) {
    if (currentTime - job.updatedAt > maxAgeMs) {
      jobs.delete(id);
    }
  }
}

function cleanFiles(files: any[]): VirtualFile[] {
  return files
    .filter((file) => file?.path)
    .map((file) => ({
      path: normalizePath(file.path),
      content:
        typeof file.content === "string"
          ? file.content
          : "",
    }));
}

function normalizePath(value: string) {
  if (!value.startsWith("/")) {
    return `/${value}`;
  }

  return value;
}

setInterval(async () => {
  try {
    const { cleanupPreviewSessions } = await import(
      "./src/core/sandbox/previewStore"
    );

    await cleanupPreviewSessions();

    cleanupOldJobs();
  } catch {
    // silent cleanup
  }
}, 1000 * 60 * 15);

app.get("/api/health", (_, res) => {
  res.json({
    ok: true,
    timestamp: Date.now(),
  });
});

app.get("/api/jobs/:id", (req, res) => {
  const job = jobs.get(req.params.id);

  if (!job) {
    return res.status(404).json({
      error: "Job not found",
    });
  }

  res.json(job);
});

app.post("/api/generate", async (req, res) => {
  try {
    const {
      projectId,
      prompt,
      currentFiles,
      isAutoImprove,
      aiConfig,
      buildMode,
    } = req.body;

    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({
        error: "Missing required field: prompt",
      });
    }

    const cleanedFiles = cleanFiles(currentFiles || []);

    const callAi = createAiCaller(aiConfig);

    const output = await orchestrateGeneration(
      {
        projectId: projectId || "default-project",
        prompt,
        currentFiles: cleanedFiles,
        isAutoImprove: Boolean(isAutoImprove),
        aiConfig,
        buildMode: buildMode || "virtual",
      },
      callAi
    );

    res.json(output);
  } catch (error: any) {
    console.error("[/api/generate]", error);

    res.status(500).json({
      error: error?.message || "Generation failed",
    });
  }
});

app.post("/api/generate-job", async (req, res) => {
  const job = createJob();

  res.json({
    ok: true,
    jobId: job.id,
  });

  queueMicrotask(async () => {
    try {
      cleanupOldJobs();

      const {
        projectId,
        prompt,
        currentFiles,
        isAutoImprove,
        aiConfig,
        buildMode,
      } = req.body;

      updateJob(job.id, {
        status: "running",
      });

      pushJobLog(job.id, "Generation started.");

      const cleanedFiles = cleanFiles(currentFiles || []);

      const callAi = createAiCaller(aiConfig);

      const output = await orchestrateGeneration(
        {
          projectId: projectId || "default-project",
          prompt,
          currentFiles: cleanedFiles,
          isAutoImprove: Boolean(isAutoImprove),
          aiConfig,
          buildMode: buildMode || "virtual",
        },
        async (promptText: string) => {
          pushJobLog(job.id, "Calling AI provider.");

          const result = await callAi(promptText);

          pushJobLog(job.id, "AI provider responded.");

          return result;
        }
      );

      updateJob(job.id, {
        status: "success",
        result: output,
      });

      pushJobLog(job.id, "Generation completed.");
    } catch (error: any) {
      console.error("[/api/generate-job]", error);

      updateJob(job.id, {
        status: "error",
        error: error?.message || "Generation failed",
      });

      pushJobLog(
        job.id,
        error?.message || "Generation failed"
      );
    }
  });
});

app.post("/api/autopilot/run", async (req, res) => {
  const job = createJob();

  res.json({
    ok: true,
    jobId: job.id,
  });

  queueMicrotask(async () => {
    try {
      cleanupOldJobs();

      const {
        projectId,
        prompt,
        files,
        aiConfig,
        buildMode,
        targetScore,
        maxIterations,
      } = req.body;

      updateJob(job.id, {
        status: "running",
      });

      pushJobLog(job.id, "Autopilot started.");

      if (!prompt || typeof prompt !== "string") {
        throw new Error("Missing required field: prompt");
      }

      if (!Array.isArray(files)) {
        throw new Error("Missing required field: files");
      }

      const cleanedFiles = cleanFiles(files);

      const callAi = createAiCaller(aiConfig);

      const { runAutopilot } = await import(
        "./src/core/engine/autopilot"
      );

      const output = await runAutopilot({
        projectId: projectId || "default-project",
        prompt,
        files: cleanedFiles,
        callAi: async (promptText: string) => {
          pushJobLog(job.id, "Calling AI provider.");

          const result = await callAi(promptText);

          pushJobLog(job.id, "AI provider responded.");

          return result;
        },
        buildMode: buildMode || "virtual",
        targetScore: Number(targetScore || 90),
        maxIterations: Number(maxIterations || 5),
        onLog: (message) => pushJobLog(job.id, message),
      });

      updateJob(job.id, {
        status: "success",
        result: output,
      });

      pushJobLog(job.id, "Autopilot completed.");
    } catch (error: any) {
      console.error("[/api/autopilot/run]", error);

      updateJob(job.id, {
        status: "error",
        error: error?.message || "Autopilot failed.",
      });

      pushJobLog(
        job.id,
        error?.message || "Autopilot failed."
      );
    }
  });
});

app.post("/api/build/check", async (req, res) => {
  try {
    const { files, mode } = req.body;

    const cleanedFiles = cleanFiles(files || []);

    if (mode === "real") {
      const { runRealBuild } = await import(
        "./src/core/sandbox/realBuildRunner"
      );

      const result = await runRealBuild(cleanedFiles);

      return res.json(result);
    }

    const { virtualBuildCheck } = await import(
      "./src/core/sandbox/virtualBuild"
    );

    const result = virtualBuildCheck(cleanedFiles);

    res.json(result);
  } catch (error: any) {
    console.error("[/api/build/check]", error);

    res.status(500).json({
      error: error?.message || "Build check failed",
    });
  }
});

app.post("/api/preview/start", async (req, res) => {
  try {
    const { files } = req.body;

    if (!Array.isArray(files)) {
      return res.status(400).json({
        error: "Missing required field: files",
      });
    }

    const {
      startPreviewSession,
      cleanupPreviewSessions,
    } = await import(
      "./src/core/sandbox/previewStore"
    );

    await cleanupPreviewSessions();

    const session = await startPreviewSession(
      cleanFiles(files)
    );

    res.json({
      ok: true,
      session,
    });
  } catch (error: any) {
    console.error("[/api/preview/start]", error);

    res.status(500).json({
      error: error?.message || "Preview start failed",
    });
  }
});

app.get("/api/preview/:id", async (req, res) => {
  try {
    const { getPreviewSession } = await import(
      "./src/core/sandbox/previewStore"
    );

    const session = getPreviewSession(req.params.id);

    if (!session) {
      return res.status(404).json({
        error: "Preview session not found",
      });
    }

    res.json(session);
  } catch (error: any) {
    res.status(500).json({
      error: error?.message || "Preview fetch failed",
    });
  }
});

app.delete("/api/preview/:id", async (req, res) => {
  try {
    const { stopPreviewSession } = await import(
      "./src/core/sandbox/previewStore"
    );

    const session = await stopPreviewSession(
      req.params.id
    );

    res.json({
      ok: true,
      session,
    });
  } catch (error: any) {
    res.status(500).json({
      error: error?.message || "Preview stop failed",
    });
  }
});

app.get("/api/memory/:projectId", async (req, res) => {
  try {
    const { loadProjectMemory } = await import(
      "./src/core/engine/memory"
    );

    const memory = await loadProjectMemory(
      req.params.projectId
    );

    res.json({
      ok: true,
      memory,
    });
  } catch (error: any) {
    res.status(500).json({
      error: error?.message || "Memory load failed",
    });
  }
});

app.delete("/api/memory/:projectId", async (req, res) => {
  try {
    const { resetProjectMemory } = await import(
      "./src/core/engine/memory"
    );

    const memory = await resetProjectMemory(
      req.params.projectId
    );

    res.json({
      ok: true,
      memory,
    });
  } catch (error: any) {
    res.status(500).json({
      error: error?.message || "Memory reset failed",
    });
  }
});

app.use(express.static(path.join(__dirname, "dist")));

app.get("*", (_, res) => {
  res.sendFile(path.join(__dirname, "dist/index.html"));
});

async function startServer() {
  const port = Number(process.env.PORT || 3000);

  app.listen(port, () => {
    console.log(`Forge server running on port ${port}`);
  });
}

startServer();
