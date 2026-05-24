import { Hono } from "hono";
import { cors } from "hono/cors";

type Env = {
  DB?: D1Database;
  GEMINI_API_KEY?: string;
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;
  DEFAULT_AI_PROVIDER?: string;
  DEFAULT_GEMINI_MODEL?: string;
  DEFAULT_OPENAI_MODEL?: string;
};

type VirtualFile = {
  path: string;
  content: string | null;
};

type AiConfig = {
  provider?: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
};

type BuildMode = "none" | "virtual" | "real";

type MemoryJob = {
  id: string;
  status: "queued" | "running" | "success" | "error";
  createdAt: number;
  updatedAt: number;
  logs: string[];
  result?: unknown;
  error?: string;
};

type PersistentJob = {
  id: string;
  prompt: string;
  status: "running" | "paused" | "done" | "error";
  phase: string;
  target: string;
  score: number;
  attempts: number;
  max_attempts: number;
  files_json: string;
  logs_json: string;
  error: string | null;
  created_at: number;
  updated_at: number;
  next_run_at: number;
  last_score: number;
  stagnant_steps: number;
  strategy: string;
  files?: VirtualFile[];
  logs?: string[];
};

const app = new Hono<{ Bindings: Env }>();
const memoryJobs = new Map<string, MemoryJob>();

const AUTONOMOUS_PHASES = [
  "product_spec",
  "architecture",
  "base_files",
  "ui_system",
  "core_features",
  "gameplay_or_business_logic",
  "sprites_and_assets",
  "animations_and_feedback",
  "virtual_build",
  "repair",
  "launch_pack",
  "final_packaging",
  "final_audit",
  "done",
];

app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  })
);

app.get("/api/health", (c) =>
  c.json({
    ok: true,
    service: "AutoApp API",
    runtime: "cloudflare-workers",
    timestamp: Date.now(),
  })
);

app.get("/api/ai/test", async (c) => {
  try {
    const result = await callGemini(
      c.env,
      { model: c.env.DEFAULT_GEMINI_MODEL || "gemini-2.5-flash" },
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

app.post("/api/generate", async (c) => {
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

app.post("/api/generate-job", async (c) => {
  const body = await c.req.json().catch(() => null);
  const job = createMemoryJob();

  c.executionCtx.waitUntil(
    runMemoryJob(job.id, async () => {
      if (!body?.prompt || typeof body.prompt !== "string") {
        throw new Error("Missing required field: prompt");
      }

      pushMemoryJobLog(job.id, "Generation started.");

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

  return c.json({
    ok: true,
    jobId: job.id,
  });
});

app.post("/api/autopilot/run", async (c) => {
  const body = await c.req.json().catch(() => null);
  const job = createMemoryJob();

  c.executionCtx.waitUntil(
    runMemoryJob(job.id, async () => {
      if (!body?.prompt || typeof body.prompt !== "string") {
        throw new Error("Missing required field: prompt");
      }

      let files = cleanFiles(body.files || []);
      const iterations: any[] = [];
      const logs: string[] = [];
      const targetScore = Number(body.targetScore || 90);
      const maxIterations = Math.max(1, Math.min(5, Number(body.maxIterations || 3)));

      for (let index = 1; index <= maxIterations; index++) {
        const previousScore = iterations.at(-1)?.score?.total || 0;

        if (previousScore >= targetScore) break;

        const log = `Autopilot iteration ${index}/${maxIterations}`;
        logs.unshift(`${new Date().toISOString()} · ${log}`);
        pushMemoryJobLog(job.id, log);

        const result = await generateProject({
          env: c.env,
          prompt: [
            "Improve this project while preserving existing features.",
            `Original goal: ${body.prompt}`,
            `Previous score: ${previousScore}`,
            `Target score: ${targetScore}`,
            "Return complete changed files only.",
          ].join("\n"),
          files,
          aiConfig: body.aiConfig || {},
          buildMode: body.buildMode || "virtual",
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

  return c.json({
    ok: true,
    jobId: job.id,
  });
});

app.get("/api/jobs", async (c) => {
  if (!c.env.DB) return c.json({ error: "D1 DB binding missing" }, 500);

  const jobs = await listPersistentJobs(c.env.DB);

  return c.json({
    ok: true,
    jobs,
  });
});

app.post("/api/jobs/create", async (c) => {
  if (!c.env.DB) return c.json({ error: "D1 DB binding missing" }, 500);

  const body = await c.req.json().catch(() => null);

  if (!body?.prompt || typeof body.prompt !== "string") {
    return c.json({ error: "Missing prompt" }, 400);
  }

  const job = await createPersistentJob(c.env.DB, {
    prompt: body.prompt,
    target: body.target || detectTarget(body.prompt),
  });

  c.executionCtx.waitUntil(runPersistentJobStep(c.env, job.id));

  return c.json({
    ok: true,
    jobId: job.id,
    job: publicJob(job),
  });
});

app.get("/api/jobs/:id", async (c) => {
  const id = c.req.param("id");

  const memoryJob = memoryJobs.get(id);
  if (memoryJob) return c.json(memoryJob);

  if (!c.env.DB) return c.json({ error: "Job not found" }, 404);

  const job = await getPersistentJob(c.env.DB, id);
  if (!job) return c.json({ error: "Job not found" }, 404);

  return c.json(publicJob(job));
});

app.post("/api/jobs/:id/step", async (c) => {
  if (!c.env.DB) return c.json({ error: "D1 DB binding missing" }, 500);

  const job = await runPersistentJobStep(c.env, c.req.param("id"));

  return c.json({
    ok: true,
    job: publicJob(job),
  });
});

app.post("/api/jobs/:id/resume", async (c) => {
  if (!c.env.DB) return c.json({ error: "D1 DB binding missing" }, 500);

  const job = await getPersistentJob(c.env.DB, c.req.param("id"));
  if (!job) return c.json({ error: "Job not found" }, 404);

  job.status = "running";
  job.error = "";
  job.next_run_at = Date.now();

  await savePersistentJob(c.env.DB, job);

  c.executionCtx.waitUntil(runPersistentJobStep(c.env, job.id));

  return c.json({
    ok: true,
    job: publicJob(job),
  });
});

app.get("/api/jobs/:id/files", async (c) => {
  if (!c.env.DB) return c.json({ error: "D1 DB binding missing" }, 500);

  const job = await getPersistentJob(c.env.DB, c.req.param("id"));
  if (!job) return c.json({ error: "Job not found" }, 404);

  return c.json({
    ok: true,
    jobId: job.id,
    files: safeJsonArray(job.files_json),
    phase: job.phase,
    score: job.score,
    status: job.status,
  });
});

app.get("/api/jobs/:id/report", async (c) => {
  if (!c.env.DB) return c.json({ error: "D1 DB binding missing" }, 500);

  const job = await getPersistentJob(c.env.DB, c.req.param("id"));
  if (!job) return c.json({ error: "Job not found" }, 404);

  const files = safeJsonArray(job.files_json);
  const build = virtualBuildCheck(files);
  const score = scoreProject(files);

  return c.json({
    ok: true,
    report: createAutonomousReport({
      job,
      files,
      build,
      score,
      targetProfile: getTargetProfile(job.target),
    }),
  });
});

app.post("/api/build/check", async (c) => {
  const body = await c.req.json().catch(() => null);
  return c.json(virtualBuildCheck(cleanFiles(body?.files || [])));
});

app.post("/api/score", async (c) => {
  const body = await c.req.json().catch(() => null);

  return c.json({
    ok: true,
    score: scoreProject(cleanFiles(body?.files || [])),
  });
});

app.post("/api/inspect", async (c) => {
  const body = await c.req.json().catch(() => null);

  return c.json({
    ok: true,
    inspection: inspectProject(cleanFiles(body?.files || [])),
  });
});

app.post("/api/dependencies/resolve", async (c) => {
  const body = await c.req.json().catch(() => null);
  const files = cleanFiles(body?.files || []);
  const resolution = resolveDependencies(files);

  return c.json({
    ok: true,
    resolution,
    files: body?.apply ? applyDependencyResolution(files, resolution.packageJson) : undefined,
  });
});

app.get("/api/templates", (c) =>
  c.json({
    ok: true,
    templates: listTemplates(),
  })
);

app.post("/api/templates/apply", async (c) => {
  const body = await c.req.json().catch(() => null);
  const template = listTemplates().find((item) => item.id === body?.id);

  if (!template) return c.json({ error: "Template not found" }, 404);

  return c.json({
    ok: true,
    template,
  });
});

app.post("/api/deployment/pack", async (c) => {
  const body = await c.req.json().catch(() => null);
  const files = cleanFiles(body?.files || []);
  const additions = createDeploymentPack(files);

  return c.json({
    ok: true,
    files: additions,
    count: additions.length,
  });
});

app.post("/api/publish/report", async (c) => {
  const body = await c.req.json().catch(() => null);
  const files = cleanFiles(body?.files || []);

  return c.json({
    ok: true,
    report: createPublishReport(files),
  });
});

app.get("/api/memory/:projectId", (c) =>
  c.json({
    ok: true,
    memory: createEmptyMemory(c.req.param("projectId")),
  })
);

app.delete("/api/memory/:projectId", (c) =>
  c.json({
    ok: true,
    memory: createEmptyMemory(c.req.param("projectId")),
  })
);

app.post("/api/preview/start", async (c) =>
  c.json({
    ok: true,
    session: {
      id: crypto.randomUUID(),
      status: "running",
      url: "",
      logs: ["Static preview only on free Cloudflare stack."],
    },
  })
);

app.get("/api/preview/:id", (c) =>
  c.json({
    id: c.req.param("id"),
    status: "running",
    url: "",
    logs: ["Static preview only on free Cloudflare stack."],
  })
);

app.delete("/api/preview/:id", (c) =>
  c.json({
    ok: true,
    session: {
      id: c.req.param("id"),
      status: "stopped",
    },
  })
);

async function generateProject(params: {
  env: Env;
  prompt: string;
  files: VirtualFile[];
  aiConfig?: AiConfig;
  buildMode?: BuildMode;
  isAutoImprove?: boolean;
}) {
  let currentFiles = cleanFiles(params.files || []);
  const changelog: string[] = [];

  const output = await callAiJson(params.env, params.aiConfig, buildExpertPrompt({
    userPrompt: params.prompt,
    files: currentFiles,
    build: virtualBuildCheck(currentFiles),
    score: scoreProject(currentFiles),
    target: detectTarget(params.prompt),
  }));

  let changedFiles = normalizeGeneratedFiles(output?.files || []);
  currentFiles = mergeFiles(currentFiles, changedFiles);
  currentFiles = applyDependencyResolution(currentFiles, resolveDependencies(currentFiles).packageJson);

  let build = virtualBuildCheck(currentFiles);
  let score = scoreProject(currentFiles);

  if (!build.ok) {
    const repair = await callAiJson(params.env, params.aiConfig, buildRepairPrompt({
      userPrompt: params.prompt,
      files: currentFiles,
      build,
      score,
    }));

    changedFiles = normalizeGeneratedFiles(repair?.files || []);
    currentFiles = mergeFiles(currentFiles, changedFiles);
    currentFiles = applyDependencyResolution(currentFiles, resolveDependencies(currentFiles).packageJson);

    changelog.push(String(repair?.changelog || "Repair pass applied."));
  }

  build = virtualBuildCheck(currentFiles);
  score = scoreProject(currentFiles);

  changelog.unshift(String(output?.changelog || "Generated project files."));

  return {
    files: diffFiles(params.files, currentFiles),
    changelog: changelog.join("\n"),
    estimatedTimeSaved: String(output?.estimatedTimeSaved || "Several hours saved."),
    score,
    nextActions: buildNextActions(score, build),
    mode: build.ok ? (params.files.length ? "improve" : "create") : "repair",
  };
}

async function runPersistentJobStep(env: Env, id: string) {
  if (!env.DB) throw new Error("D1 DB binding missing");

  const job = await getPersistentJob(env.DB, id);
  if (!job) throw new Error("Job not found");
  if (job.status === "done") return job;

  if (job.attempts >= job.max_attempts) {
    job.status = "paused";
    job.error = "Max attempts reached.";
    job.next_run_at = Date.now() + 10 * 60_000;
    await savePersistentJob(env.DB, job);
    return job;
  }

  const files = safeJsonArray(job.files_json);
  const buildBefore = virtualBuildCheck(files);
  const scoreBefore = scoreProject(files);

  const output = await callAiJson(env, {}, buildPhasePrompt({
    phase: job.phase,
    prompt: job.prompt,
    target: job.target,
    files,
    build: buildBefore,
    score: scoreBefore,
    strategy: job.strategy,
  }));

  let nextFiles = mergeFiles(files, normalizeGeneratedFiles(output?.files || []));

  if (job.phase === "sprites_and_assets") {
    nextFiles = mergeFiles(nextFiles, createGeneratedGameAssets(job.prompt));
  }

  if (job.target.includes("android")) {
    nextFiles = mergeFiles(nextFiles, createAndroidCapacitorFiles(job.prompt));
  }

  nextFiles = applyDependencyResolution(nextFiles, resolveDependencies(nextFiles).packageJson);

  let build = virtualBuildCheck(nextFiles);
  let score = scoreProject(nextFiles);

  if (job.phase === "final_packaging") {
    nextFiles = mergeFiles(
      nextFiles,
      createFinalPackagingFiles({
        prompt: job.prompt,
        target: job.target,
        files: nextFiles,
        score,
      })
    );

    build = virtualBuildCheck(nextFiles);
    score = scoreProject(nextFiles);
  }

  const previousScore = Number(job.score || job.last_score || 0);
  const improvement = score.total - previousScore;

  job.last_score = previousScore;
  job.stagnant_steps = improvement <= 1 ? Number(job.stagnant_steps || 0) + 1 : 0;
  job.strategy = chooseNextStrategy({ job, phase: job.phase, build, score, improvement });
  job.phase = getNextPhaseWithStrategy({ phase: job.phase, build, score, job });
  job.score = score.total;
  job.attempts += 1;
  job.files_json = JSON.stringify(nextFiles);
  job.logs_json = JSON.stringify([
    `${new Date().toISOString()} · ${job.phase}: score ${score.total}/100 · ${job.strategy}`,
    ...safeJsonArray(job.logs_json),
  ].slice(0, 200));
  job.error = "";
  job.status = job.phase === "done" ? "done" : "running";
  job.next_run_at = Date.now() + 5 * 60_000;

  await savePersistentJob(env.DB, job);
  return job;
}

async function runScheduledJobs(env: Env) {
  if (!env.DB) return;

  const result = await env.DB.prepare(
    `SELECT id FROM jobs
     WHERE status IN ('running', 'paused')
     AND next_run_at <= ?
     ORDER BY updated_at ASC
     LIMIT 3`
  ).bind(Date.now()).all();

  for (const item of result.results || []) {
    try {
      await runPersistentJobStep(env, String((item as any).id));
    } catch {
      // keep cron safe
    }
  }
}

function buildExpertPrompt(input: {
  userPrompt: string;
  files: VirtualFile[];
  build: any;
  score: any;
  target: string;
}) {
  return [
    "You are AutoApp, an expert autonomous app builder.",
    "Return ONLY valid JSON. No markdown.",
    "",
    "Required shape:",
    JSON.stringify({
      files: [
        { path: "/package.json", content: "complete file content" },
        { path: "/index.html", content: "complete file content" },
        { path: "/vite.config.ts", content: "complete file content" },
        { path: "/tsconfig.json", content: "complete file content" },
        { path: "/src/main.tsx", content: "complete file content" },
        { path: "/src/App.tsx", content: "complete file content" },
        { path: "/src/style.css", content: "complete file content" },
      ],
      changelog: "summary",
      estimatedTimeSaved: "estimate",
    }, null, 2),
    "",
    "Rules:",
    "- Generate a complete usable product, not a demo.",
    "- Return complete changed files only.",
    "- Prefer React + Vite + TypeScript.",
    "- Keep npm install && npm run build valid.",
    "- Include mobile-first UI, states, interactions, and deployment readiness.",
    "- For games: include gameplay loop, score, controls, restart, progression.",
    "- For Android: include Capacitor readiness.",
    "",
    "Target:",
    input.target,
    "",
    "User request:",
    input.userPrompt,
    "",
    "Current build:",
    JSON.stringify(input.build, null, 2),
    "",
    "Current score:",
    JSON.stringify(input.score, null, 2),
    "",
    "Current files:",
    serializeFiles(input.files),
  ].join("\n");
}

function buildRepairPrompt(input: {
  userPrompt: string;
  files: VirtualFile[];
  build: any;
  score: any;
}) {
  return [
    "You are AutoApp repair agent.",
    "Return ONLY valid JSON. No markdown.",
    "",
    "Required shape:",
    JSON.stringify({
      files: [{ path: "/src/App.tsx", content: "complete corrected file content" }],
      changelog: "repair summary",
      estimatedTimeSaved: "estimate",
    }, null, 2),
    "",
    "Fix all build/import/dependency/JSON issues.",
    "",
    "User request:",
    input.userPrompt,
    "",
    "Build issues:",
    JSON.stringify(input.build, null, 2),
    "",
    "Files:",
    serializeFiles(input.files),
  ].join("\n");
}

function buildPhasePrompt(input: {
  phase: string;
  prompt: string;
  target: string;
  files: VirtualFile[];
  build: any;
  score: any;
  strategy?: string;
}) {
  return [
    `You are AutoApp autonomous phase agent: ${input.phase}.`,
    "Return ONLY valid JSON. No markdown.",
    "",
    "Required shape:",
    JSON.stringify({
      files: [{ path: "/src/App.tsx", content: "complete file content" }],
      changelog: "phase summary",
      estimatedTimeSaved: "estimate",
    }, null, 2),
    "",
    "Goal:",
    input.prompt,
    "",
    "Target:",
    input.target,
    "",
    "Target profile:",
    JSON.stringify(getTargetProfile(input.target), null, 2),
    "",
    "Current strategy:",
    input.strategy || "normal",
    "",
    "Strategy instruction:",
    getStrategyInstruction(input.strategy || "normal"),
    "",
    "Phase instruction:",
    getPhaseInstruction(input.phase, input.target),
    "",
    "Current build:",
    JSON.stringify(input.build, null, 2),
    "",
    "Current score:",
    JSON.stringify(input.score, null, 2),
    "",
    "Current files:",
    serializeFiles(input.files),
  ].join("\n");
}

async function callAiJson(env: Env, aiConfig: AiConfig | undefined, prompt: string) {
  const provider = aiConfig?.provider || env.DEFAULT_AI_PROVIDER || "gemini";
  if (provider === "gemini") return callGemini(env, aiConfig, prompt);
  return callOpenAiCompatible(env, aiConfig, prompt);
}

async function callGemini(env: Env, aiConfig: AiConfig | undefined, prompt: string) {
  const key = aiConfig?.apiKey || env.GEMINI_API_KEY;
  if (!key) throw new Error("Missing GEMINI_API_KEY.");

  const model = aiConfig?.model || env.DEFAULT_GEMINI_MODEL || "gemini-2.5-flash";

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.25,
          responseMimeType: "application/json",
        },
      }),
    }
  );

  const data: any = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || "Gemini request failed.");

  return parseJson(data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}");
}

async function callOpenAiCompatible(env: Env, aiConfig: AiConfig | undefined, prompt: string) {
  const key = aiConfig?.apiKey || env.OPENAI_API_KEY;
  if (!key) throw new Error("Missing OPENAI_API_KEY.");

  const baseUrl = aiConfig?.baseUrl || env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  const model = aiConfig?.model || env.DEFAULT_OPENAI_MODEL || "gpt-4o-mini";

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.25,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Return ONLY valid JSON. No markdown." },
        { role: "user", content: prompt },
      ],
    }),
  });

  const data: any = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || "OpenAI-compatible request failed.");

  return parseJson(data?.choices?.[0]?.message?.content || "{}");
}

function parseJson(text: string) {
  const cleaned = String(text || "")
    .trim()
    .replace(/^```json/i, "")
    .replace(/^```/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const objectStart = cleaned.indexOf("{");
    const objectEnd = cleaned.lastIndexOf("}");
    if (objectStart >= 0 && objectEnd > objectStart) {
      try {
        return JSON.parse(cleaned.slice(objectStart, objectEnd + 1));
      } catch {
        return fallbackAiOutput();
      }
    }
    return fallbackAiOutput();
  }
}

function fallbackAiOutput() {
  return {
    files: createFallbackProjectFiles(),
    changelog: "AI returned invalid JSON. Safe fallback project generated.",
    estimatedTimeSaved: "Fallback recovery",
  };
}

function createFallbackProjectFiles(): VirtualFile[] {
  return [
    {
      path: "/package.json",
      content: JSON.stringify({
        name: "autoapp-generated-project",
        version: "1.0.0",
        private: true,
        type: "module",
        scripts: { dev: "vite", build: "vite build", preview: "vite preview" },
        dependencies: { "@tailwindcss/vite": "latest", react: "latest", "react-dom": "latest" },
        devDependencies: { "@vitejs/plugin-react": "latest", typescript: "latest", vite: "latest" },
      }, null, 2),
    },
    {
      path: "/index.html",
      content:
        '<!doctype html><html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>AutoApp Generated Project</title><meta name="description" content="Generated with AutoApp." /></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>',
    },
    {
      path: "/vite.config.ts",
      content:
        'import { defineConfig } from "vite";\nimport react from "@vitejs/plugin-react";\nimport tailwindcss from "@tailwindcss/vite";\n\nexport default defineConfig({ plugins: [react(), tailwindcss()] });\n',
    },
    {
      path: "/tsconfig.json",
      content: JSON.stringify({
        compilerOptions: {
          target: "ES2020",
          useDefineForClassFields: true,
          lib: ["DOM", "DOM.Iterable", "ES2020"],
          allowJs: false,
          skipLibCheck: true,
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          strict: true,
          forceConsistentCasingInFileNames: true,
          module: "ESNext",
          moduleResolution: "Node",
          resolveJsonModule: true,
          isolatedModules: true,
          noEmit: true,
          jsx: "react-jsx",
        },
        include: ["src"],
      }, null, 2),
    },
    {
      path: "/src/main.tsx",
      content:
        'import React from "react";\nimport ReactDOM from "react-dom/client";\nimport App from "./App";\nimport "./style.css";\n\nReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);\n',
    },
    {
      path: "/src/App.tsx",
      content:
        'export default function App() {\n  return <main className="min-h-screen bg-[#050505] px-6 py-16 text-white"><section className="mx-auto max-w-5xl rounded-3xl border border-white/10 bg-white/[0.04] p-8 shadow-2xl"><p className="text-xs uppercase tracking-[0.35em] text-zinc-500">AutoApp</p><h1 className="mt-4 text-5xl font-black tracking-tight md:text-7xl">Generated app recovered safely.</h1><p className="mt-6 max-w-2xl text-zinc-400">The AI response was invalid, so AutoApp generated a safe buildable fallback project.</p></section></main>;\n}\n',
    },
    {
      path: "/src/style.css",
      content:
        '@import "tailwindcss";\n\n* { box-sizing: border-box; }\nbody { margin: 0; background: #050505; color: white; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }\n',
    },
  ];
}

function cleanFiles(files: unknown): VirtualFile[] {
  if (!Array.isArray(files)) return [];
  return files
    .filter((file: any) => file?.path)
    .map((file: any) => ({
      path: normalizePath(String(file.path)),
      content: file.content === null ? null : String(file.content || ""),
    }))
    .filter((file) => !file.path.includes("node_modules") && !file.path.includes(".git/"));
}

function normalizeGeneratedFiles(files: unknown): VirtualFile[] {
  if (!Array.isArray(files)) return [];
  const seen = new Set<string>();

  return files
    .filter((file: any) => file?.path)
    .map((file: any) => ({
      path: normalizePath(String(file.path)),
      content: file.content === null ? null : String(file.content || ""),
    }))
    .filter((file) => {
      if (seen.has(file.path)) return false;
      seen.add(file.path);
      return true;
    });
}

function mergeFiles(currentFiles: VirtualFile[], changedFiles: VirtualFile[]) {
  const map = new Map<string, VirtualFile>();

  for (const file of currentFiles || []) {
    map.set(normalizePath(file.path), { path: normalizePath(file.path), content: file.content });
  }

  for (const file of changedFiles || []) {
    const path = normalizePath(file.path);
    if (file.content === null) map.delete(path);
    else map.set(path, { path, content: file.content });
  }

  return Array.from(map.values()).sort((a, b) => a.path.localeCompare(b.path));
}

function diffFiles(previous: VirtualFile[], next: VirtualFile[]) {
  const previousMap = new Map(previous.map((file) => [normalizePath(file.path), file.content]));
  return next.filter((file) => previousMap.get(normalizePath(file.path)) !== file.content);
}

function normalizePath(path: string) {
  const value = String(path || "").trim();
  return value.startsWith("/") ? value : `/${value}`;
}

function serializeFiles(files: VirtualFile[]) {
  return JSON.stringify(
    files.slice(0, 22).map((file) => ({
      path: file.path,
      content: String(file.content || "").slice(0, 12_000),
    })),
    null,
    2
  );
}

function virtualBuildCheck(files: VirtualFile[]) {
  const logs: string[] = [];
  const paths = new Set(files.map((file) => normalizePath(file.path)));
  const packageFile = files.find((file) => normalizePath(file.path) === "/package.json");

  if (!packageFile?.content) {
    logs.push("Missing /package.json");
  } else {
    try {
      const pkg = JSON.parse(packageFile.content);
      if (!pkg.scripts?.build) logs.push("/package.json: missing scripts.build");
      if (!pkg.dependencies?.react && !pkg.devDependencies?.react) {
        logs.push("/package.json: Cannot find module 'react'");
      }
      if (!pkg.dependencies?.["react-dom"] && !pkg.devDependencies?.["react-dom"]) {
        logs.push("/package.json: Cannot find module 'react-dom'");
      }
    } catch {
      logs.push("/package.json: invalid JSON");
    }
  }

  if (!paths.has("/index.html")) logs.push("Missing /index.html");
  if (!paths.has("/src/main.tsx") && !paths.has("/src/main.jsx")) logs.push("Missing /src/main.tsx");
  if (!paths.has("/src/App.tsx") && !paths.has("/src/App.jsx")) logs.push("Missing /src/App.tsx");

  for (const file of files) {
    if (file.path.endsWith(".json") && file.content) {
      try {
        JSON.parse(file.content);
      } catch {
        logs.push(`${file.path}: invalid JSON`);
      }
    }
    if (String(file.content || "").includes("<<<<<<<") || String(file.content || "").includes(">>>>>>>")) {
      logs.push(`${file.path}: git conflict markers found`);
    }
  }

  return {
    ok: logs.length === 0,
    issues: logs.map((message) => ({ type: detectIssueType(message), message, raw: message })),
    log: logs.join("\n"),
  };
}

function detectIssueType(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("cannot find module")) return "missing_dependency";
  if (lower.includes("invalid json")) return "json";
  if (lower.includes("missing")) return "missing_file";
  return "unknown";
}

function scoreProject(files: VirtualFile[]) {
  const paths = files.map((file) => normalizePath(file.path));
  const all = files.map((file) => file.content || "").join("\n").toLowerCase();
  const app = files.find((file) => normalizePath(file.path) === "/src/App.tsx");
  const appContent = String(app?.content || "").toLowerCase();

  const architecture = clamp(
    8 +
      Number(paths.includes("/package.json")) * 10 +
      Number(paths.includes("/index.html")) * 8 +
      Number(paths.includes("/vite.config.ts") || paths.includes("/vite.config.js")) * 8 +
      Number(paths.includes("/tsconfig.json")) * 6 +
      Number(paths.includes("/src/main.tsx") || paths.includes("/src/main.jsx")) * 8 +
      Number(paths.includes("/src/App.tsx") || paths.includes("/src/App.jsx")) * 8 +
      Number(files.length >= 7) * 8 +
      Number(files.length >= 12) * 8
  );

  const ui = clamp(
    5 +
      Number(all.includes("rounded")) * 8 +
      Number(all.includes("shadow")) * 8 +
      Number(all.includes("border")) * 6 +
      Number(all.includes("gradient") || all.includes("bg-[")) * 8 +
      Number(all.includes("grid")) * 6 +
      Number(all.includes("card")) * 6 +
      Number(all.includes("nav")) * 7 +
      Number(all.includes("transition") || all.includes("animation")) * 8 +
      Number(appContent.length > 6000) * 8
  );

  const mobile = clamp(
    5 +
      Number(all.includes("viewport")) * 12 +
      Number(all.includes("sm:") || all.includes("md:")) * 14 +
      Number(all.includes("flex")) * 8 +
      Number(all.includes("grid")) * 8 +
      Number(all.includes("min-h-screen")) * 8 +
      Number(all.includes("max-w-")) * 8
  );

  const performance = clamp(
    30 +
      Number(paths.includes("/vite.config.ts") || paths.includes("/vite.config.js")) * 14 +
      Number(!all.includes("while (true")) * 8 +
      Number(appContent.length < 45000) * 10 +
      Number(!all.includes("base64,")) * 10
  );

  const accessibility = clamp(
    5 +
      Number(all.includes("aria-")) * 14 +
      Number(all.includes("alt=")) * 10 +
      Number(all.includes("label")) * 10 +
      Number(all.includes("<button")) * 8 +
      Number(all.includes("<main")) * 8 +
      Number(all.includes("<section")) * 8
  );

  const seo = clamp(
    5 +
      Number(all.includes("<title>") || all.includes("title>")) * 10 +
      Number(all.includes("description")) * 12 +
      Number(all.includes("og:title")) * 12 +
      Number(paths.includes("/robots.txt")) * 8 +
      Number(paths.includes("/sitemap.xml")) * 8 +
      Number(paths.includes("/README.md")) * 10
  );

  const maintainability = clamp(
    8 +
      Number(all.includes("const ")) * 6 +
      Number(all.includes("function ")) * 6 +
      Number(all.includes("type ") || all.includes("interface ")) * 8 +
      Number(!all.includes("todo")) * 8 +
      Number(paths.includes("/README.md")) * 8
  );

  const monetization = clamp(
    5 +
      Number(all.includes("pricing")) * 18 +
      Number(all.includes("checkout") || all.includes("subscribe")) * 16 +
      Number(all.includes("cta") || all.includes("get started")) * 12 +
      Number(all.includes("testimonial") || all.includes("faq")) * 10
  );

  const reliability = clamp(
    5 +
      Number(all.includes("try")) * 8 +
      Number(all.includes("catch")) * 8 +
      Number(all.includes("error")) * 8 +
      Number(all.includes("loading")) * 8 +
      Number(all.includes("empty")) * 8 +
      Number(all.includes("fallback")) * 8 +
      Number(paths.includes("/.env.example")) * 8
  );

  const productDepth = clamp(
    5 +
      Number(appContent.includes("dashboard")) * 10 +
      Number(appContent.includes("project")) * 8 +
      Number(appContent.includes("settings")) * 6 +
      Number(appContent.includes("history")) * 6 +
      Number(appContent.includes("export")) * 6 +
      Number(appContent.includes("deploy")) * 6 +
      Number(appContent.includes("score")) * 8 +
      Number(appContent.includes("game") || appContent.includes("level")) * 8
  );

  const total = clamp(
    architecture * 0.14 +
      ui * 0.13 +
      mobile * 0.11 +
      performance * 0.08 +
      accessibility * 0.09 +
      seo * 0.08 +
      maintainability * 0.12 +
      monetization * 0.07 +
      reliability * 0.12 +
      productDepth * 0.06
  );

  return {
    ui,
    mobile,
    performance,
    accessibility,
    seo,
    maintainability,
    architecture,
    monetization,
    reliability,
    productDepth,
    total,
  };
}

function inspectProject(files: VirtualFile[]) {
  const paths = files.map((file) => normalizePath(file.path));
  const packageJson = readPackageJson(files);
  const dependencies = Object.keys(packageJson?.dependencies || {});
  const devDependencies = Object.keys(packageJson?.devDependencies || {});
  const allDeps = [...dependencies, ...devDependencies];

  const framework = allDeps.includes("next")
    ? "Next.js"
    : allDeps.includes("vite") || paths.includes("/vite.config.ts")
      ? "Vite React"
      : allDeps.includes("react")
        ? "React"
        : "Unknown";

  return {
    framework,
    language: paths.some((path) => path.endsWith(".ts") || path.endsWith(".tsx")) ? "TypeScript" : "JavaScript",
    packageManager: "npm",
    dependencies,
    devDependencies,
    entrypoints: paths.filter((path) => ["/index.html", "/src/main.tsx", "/src/App.tsx"].includes(path)),
    missingCriticalFiles: [
      !paths.includes("/package.json") ? "/package.json" : "",
      !paths.includes("/index.html") ? "/index.html" : "",
      !paths.includes("/src/main.tsx") ? "/src/main.tsx" : "",
      !paths.includes("/src/App.tsx") ? "/src/App.tsx" : "",
    ].filter(Boolean),
    risks: framework === "Unknown" ? ["Framework could not be detected."] : [],
    strengths: framework !== "Unknown" ? [`${framework} detected.`] : [],
  };
}

function resolveDependencies(files: VirtualFile[]) {
  const used = new Set<string>();

  for (const file of files) {
    if (!file.content) continue;

    const matches = file.content.matchAll(/from\s+["']([^"']+)["']/g);
    for (const match of matches) {
      const pkg = normalizePackageName(match[1]);
      if (pkg && !pkg.startsWith(".") && !pkg.startsWith("/") && !pkg.startsWith("@/")) {
        used.add(pkg);
      }
    }
  }

  const packageJson = readPackageJson(files) || createDefaultPackageJson();

  packageJson.name ||= "generated-app";
  packageJson.private = true;
  packageJson.version ||= "1.0.0";
  packageJson.type ||= "module";
  packageJson.scripts = {
    dev: "vite",
    build: "vite build",
    preview: "vite preview",
    ...(packageJson.scripts || {}),
  };

  packageJson.dependencies ||= {};
  packageJson.devDependencies ||= {};

  packageJson.dependencies.react ||= "latest";
  packageJson.dependencies["react-dom"] ||= "latest";
  packageJson.dependencies["@tailwindcss/vite"] ||= "latest";
  packageJson.devDependencies.vite ||= "latest";
  packageJson.devDependencies.typescript ||= "latest";
  packageJson.devDependencies["@vitejs/plugin-react"] ||= "latest";

  const target = detectTarget(files.map((file) => file.content || "").join("\n"));
  if (target.includes("android")) {
    packageJson.dependencies["@capacitor/core"] ||= "latest";
    packageJson.devDependencies["@capacitor/cli"] ||= "latest";
    packageJson.devDependencies["@capacitor/android"] ||= "latest";
  }

  const declared = new Set([
    ...Object.keys(packageJson.dependencies || {}),
    ...Object.keys(packageJson.devDependencies || {}),
  ]);

  const missing = Array.from(used).filter((pkg) => !declared.has(pkg));
  for (const pkg of missing) {
    if (["vite", "typescript", "@vitejs/plugin-react", "@capacitor/cli", "@capacitor/android"].includes(pkg)) {
      packageJson.devDependencies[pkg] = "latest";
    } else {
      packageJson.dependencies[pkg] = "latest";
    }
  }

  packageJson.dependencies = sortObject(packageJson.dependencies);
  packageJson.devDependencies = sortObject(packageJson.devDependencies);

  return {
    ok: missing.length === 0,
    packageJsonFound: true,
    usedPackages: Array.from(used).sort(),
    declaredDependencies: Array.from(new Set([...declared, ...missing])).sort(),
    missingDependencies: missing.sort(),
    packageJson: JSON.stringify(packageJson, null, 2),
    warnings: [],
  };
}

function createDefaultPackageJson() {
  return {
    name: "generated-app",
    private: true,
    version: "1.0.0",
    type: "module",
    scripts: { dev: "vite", build: "vite build", preview: "vite preview" },
    dependencies: {},
    devDependencies: {},
  };
}

function applyDependencyResolution(files: VirtualFile[], packageJson?: string) {
  return mergeFiles(files, [
    {
      path: "/package.json",
      content: packageJson || resolveDependencies(files).packageJson || "",
    },
  ]);
}

function detectTarget(prompt: string) {
  const text = String(prompt || "").toLowerCase();
  const has = (...words: string[]) => words.some((word) => text.includes(word));

  if (has("jeu", "game", "gaming", "addictif", "arcade", "sprite", "score", "level", "boss")) {
    if (has("android", "apk", "play store", "mobile app")) return "android-web-game";
    return "web-game";
  }

  if (has("android", "apk", "play store", "capacitor")) return "android-capacitor";
  if (has("saas", "subscription", "pricing", "workspace", "billing")) return "saas";
  if (has("dashboard", "analytics", "admin", "metrics", "kpi", "charts")) return "dashboard";
  if (has("ecommerce", "shop", "store", "cart", "checkout")) return "ecommerce";
  if (has("affiliate", "amazon", "deal", "coupon")) return "affiliate";
  if (has("trading", "forex", "crypto", "signals", "backtest")) return "trading";
  if (has("ai", "gpt", "gemini", "prompt", "chatbot", "agent")) return "ai-tool";
  if (has("crm", "lead", "pipeline", "customer")) return "crm";
  if (has("todo", "kanban", "task", "planner")) return "productivity";
  if (has("learn", "course", "quiz", "education")) return "education";

  return "web-app";
}

function getTargetProfile(target: string) {
  const profiles: Record<string, any> = {
    "web-game": {
      label: "Web Game",
      requiredFeatures: ["start screen", "game loop", "score system", "difficulty progression", "game over", "restart flow", "mobile controls"],
      recommendedFiles: ["/src/App.tsx", "/src/style.css", "/src/assets/player.svg", "/src/assets/enemy.svg", "/src/assets/coin.svg"],
    },
    "android-web-game": {
      label: "Android Web Game",
      requiredFeatures: ["touch-first controls", "PWA manifest", "Capacitor-ready structure", "game loop", "score system", "restart flow"],
      recommendedFiles: ["/manifest.webmanifest", "/capacitor.config.ts", "/src/App.tsx", "/src/style.css"],
    },
    "android-capacitor": {
      label: "Android Capacitor App",
      requiredFeatures: ["mobile-first UI", "Capacitor config", "PWA manifest", "installable app shell"],
      recommendedFiles: ["/capacitor.config.ts", "/manifest.webmanifest", "/src/App.tsx", "/src/style.css"],
    },
    saas: {
      label: "SaaS",
      requiredFeatures: ["hero", "pricing", "dashboard preview", "onboarding flow", "CTA"],
      recommendedFiles: ["/src/App.tsx", "/src/style.css", "/README.md", "/.env.example"],
    },
    dashboard: {
      label: "Dashboard",
      requiredFeatures: ["navigation", "metric cards", "activity feed", "filters", "status indicators"],
      recommendedFiles: ["/src/App.tsx", "/src/style.css"],
    },
    ecommerce: {
      label: "Ecommerce",
      requiredFeatures: ["product grid", "product detail", "cart state", "checkout mock"],
      recommendedFiles: ["/src/App.tsx", "/src/style.css"],
    },
    affiliate: {
      label: "Affiliate Deals",
      requiredFeatures: ["deal cards", "deal score", "category filters", "affiliate CTA", "SEO sections"],
      recommendedFiles: ["/src/App.tsx", "/src/style.css", "/robots.txt", "/sitemap.xml"],
    },
    trading: {
      label: "Trading Scanner",
      requiredFeatures: ["signal cards", "risk panel", "portfolio state", "watchlist"],
      recommendedFiles: ["/src/App.tsx", "/src/style.css"],
    },
    "ai-tool": {
      label: "AI Tool",
      requiredFeatures: ["prompt input", "generation output", "history", "settings", "loading/error states"],
      recommendedFiles: ["/src/App.tsx", "/src/style.css", "/.env.example"],
    },
    "web-app": {
      label: "Web App",
      requiredFeatures: ["clear navigation", "main workflow", "sample data", "states", "settings"],
      recommendedFiles: ["/src/App.tsx", "/src/style.css"],
    },
  };

  return profiles[target] || profiles["web-app"];
}

function getPhaseInstruction(phase: string, target: string) {
  const map: Record<string, string> = {
    product_spec: "Create or improve README.md with product spec, target user, core loop, screens, features and success criteria.",
    architecture: "Create stable Vite/React architecture. Add base files if missing. Avoid broken imports.",
    base_files: "Create package.json, index.html, vite.config.ts, tsconfig.json, src/main.tsx, src/App.tsx and src/style.css if missing.",
    ui_system: "Create premium mobile-first UI, navigation, cards, panels, status badges and responsive layout.",
    core_features: "Implement main product features, real state, data models, user actions, settings and history.",
    gameplay_or_business_logic: target.includes("game")
      ? "Implement addictive gameplay loop: start, play, score, progression, difficulty, game over, restart and mobile controls."
      : "Implement core business logic, workflows, project states, scoring, automation and user actions.",
    sprites_and_assets: target.includes("game")
      ? "Create high-quality local SVG sprites, CSS effects, particle styles, collectible icons, enemy/player visuals and background layers."
      : "Create local visual assets as SVG, CSS backgrounds, icons or empty-state illustrations.",
    animations_and_feedback: target.includes("game")
      ? "Add gameplay animations: spawn, hit, collect, score, combo, level-up and game-over transitions."
      : "Add polished animations, loading/success/error states and micro-interactions.",
    virtual_build: "Fix virtual build issues and ensure all imports, dependencies and JSON files are valid.",
    repair: "Fix all build/import/dependency/JSON issues. Return only complete corrected files.",
    launch_pack: target.includes("android")
      ? "Add README, .env.example, Android build guide, Capacitor notes, manifest, app icons and APK/AAB build instructions."
      : "Add README, .env.example, robots.txt, deployment instructions and Cloudflare Pages notes.",
    final_packaging: "Create final delivery package: deployment files, README, env example, manifests, release checklist and testing checklist.",
    final_audit: "Perform final quality pass. Improve weakest score categories. Avoid regressions.",
    done: "No changes needed.",
  };

  return map[phase] || "Improve the project.";
}

function getStrategyInstruction(strategy: string) {
  const map: Record<string, string> = {
    force_product_depth: "Focus on deeper real product workflows, states, sample data, interactions and user value.",
    force_ui: "Focus on premium UI quality, hierarchy, spacing, cards, responsive layout and visual polish.",
    force_mobile: "Focus on mobile-first layout, touch ergonomics, breakpoints and overflow handling.",
    force_reliability: "Focus on loading, empty, error, fallback, disabled and recovery states.",
    force_seo: "Focus on SEO metadata, README, sitemap, robots and launch documentation.",
    force_assets: "Focus on stronger local SVG/CSS/canvas assets and game visual feedback.",
    force_feedback: "Focus on animation, feedback, transitions and interaction feel.",
    repair: "Focus only on fixing build/import/dependency/JSON issues.",
    finalize: "Focus on final packaging and release readiness.",
  };

  return map[strategy] || "Normal improvement strategy.";
}

function chooseNextStrategy(input: {
  job: PersistentJob;
  phase: string;
  build: any;
  score: any;
  improvement: number;
}) {
  if (!input.build.ok) return "repair";

  if (Number(input.job.stagnant_steps || 0) >= 3) {
    if (input.score.productDepth < 80) return "force_product_depth";
    if (input.score.ui < 85) return "force_ui";
    if (input.score.mobile < 85) return "force_mobile";
    if (input.score.reliability < 85) return "force_reliability";
    if (input.score.seo < 75) return "force_seo";
    return "finalize";
  }

  if (input.improvement >= 5) return "normal";
  if (input.phase === "sprites_and_assets") return "force_assets";
  if (input.phase === "animations_and_feedback") return "force_feedback";
  if (input.phase === "final_packaging") return "finalize";

  return input.job.strategy || "normal";
}

function getNextPhaseWithStrategy(input: {
  phase: string;
  build: any;
  score: any;
  job: PersistentJob;
}) {
  if (!input.build.ok) return "repair";
  if (input.score.total >= 92 && input.build.ok) return "done";

  const strategy = input.job.strategy || "normal";

  if (strategy === "force_product_depth") return "core_features";
  if (strategy === "force_ui") return "ui_system";
  if (strategy === "force_mobile") return "ui_system";
  if (strategy === "force_reliability") return "animations_and_feedback";
  if (strategy === "force_seo") return "launch_pack";
  if (strategy === "force_assets") return "sprites_and_assets";
  if (strategy === "force_feedback") return "animations_and_feedback";
  if (strategy === "repair") return "repair";
  if (strategy === "finalize" && input.score.total >= 82) return "final_packaging";

  const index = AUTONOMOUS_PHASES.indexOf(input.phase);
  if (index < 0) return "product_spec";

  return AUTONOMOUS_PHASES[Math.min(index + 1, AUTONOMOUS_PHASES.length - 1)];
}

function createGeneratedGameAssets(prompt: string): VirtualFile[] {
  const target = detectTarget(prompt);
  if (!target.includes("game")) return [];

  return [
    {
      path: "/src/assets/player.svg",
      content: `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><defs><linearGradient id="ship" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#67e8f9"/><stop offset=".5" stop-color="#818cf8"/><stop offset="1" stop-color="#c084fc"/></linearGradient></defs><path d="M80 10 L136 146 L80 118 L24 146 Z" fill="url(#ship)" stroke="#f8fafc" stroke-opacity=".9" stroke-width="5"/><circle cx="80" cy="72" r="18" fill="#020617" stroke="#f8fafc" stroke-opacity=".9" stroke-width="4"/></svg>`,
    },
    {
      path: "/src/assets/enemy.svg",
      content: `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><defs><radialGradient id="enemy" cx=".5" cy=".4"><stop stop-color="#fb7185"/><stop offset=".55" stop-color="#ef4444"/><stop offset="1" stop-color="#7f1d1d"/></radialGradient></defs><path d="M80 12 C122 12 148 43 148 82 C148 124 118 148 80 148 C42 148 12 124 12 82 C12 43 38 12 80 12Z" fill="url(#enemy)" stroke="#fff1f2" stroke-opacity=".8" stroke-width="5"/><circle cx="56" cy="70" r="10" fill="#020617"/><circle cx="104" cy="70" r="10" fill="#020617"/></svg>`,
    },
    {
      path: "/src/assets/coin.svg",
      content: `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><defs><linearGradient id="coin" x1="0" x2="1"><stop stop-color="#fef08a"/><stop offset=".5" stop-color="#facc15"/><stop offset="1" stop-color="#ca8a04"/></linearGradient></defs><circle cx="64" cy="64" r="50" fill="url(#coin)" stroke="#fff7ad" stroke-width="8"/><path d="M64 30 L72 54 L98 54 L76 69 L84 96 L64 80 L44 96 L52 69 L30 54 L56 54Z" fill="#fff7ad"/></svg>`,
    },
    {
      path: "/src/assets/fx.css",
      content: `.sprite-glow{filter:drop-shadow(0 0 14px rgba(103,232,249,.7))}.hit-flash{animation:hitFlash .24s ease-out}.collect-pop{animation:collectPop .36s cubic-bezier(.2,1.4,.4,1)}@keyframes hitFlash{0%{transform:scale(1);opacity:1}50%{transform:scale(1.16);opacity:.65}100%{transform:scale(1);opacity:1}}@keyframes collectPop{0%{transform:scale(.6) rotate(-8deg);opacity:.2}70%{transform:scale(1.18) rotate(4deg);opacity:1}100%{transform:scale(1) rotate(0deg);opacity:1}}`,
    },
    {
      path: "/src/assets/sprite-manifest.json",
      content: JSON.stringify({
        generated: true,
        type: "svg-sprites",
        assets: ["/src/assets/player.svg", "/src/assets/enemy.svg", "/src/assets/coin.svg", "/src/assets/fx.css"],
      }, null, 2),
    },
  ];
}

function createAndroidCapacitorFiles(prompt: string): VirtualFile[] {
  const target = detectTarget(prompt);
  if (!target.includes("android")) return [];

  return [
    {
      path: "/capacitor.config.ts",
      content: `import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.autoapp.generated",
  appName: "AutoApp Generated Game",
  webDir: "dist",
  bundledWebRuntime: false,
  server: { androidScheme: "https" }
};

export default config;
`,
    },
    {
      path: "/manifest.webmanifest",
      content: JSON.stringify({
        name: "AutoApp Generated Game",
        short_name: "AutoGame",
        description: "A mobile-first Android-ready app generated by AutoApp.",
        start_url: "/",
        display: "standalone",
        background_color: "#020617",
        theme_color: "#020617",
        orientation: "portrait",
        icons: [
          { src: "/icons/icon-192.svg", sizes: "192x192", type: "image/svg+xml", purpose: "any maskable" },
          { src: "/icons/icon-512.svg", sizes: "512x512", type: "image/svg+xml", purpose: "any maskable" },
        ],
      }, null, 2),
    },
    { path: "/public/icons/icon-192.svg", content: createAppIconSvg(192) },
    { path: "/public/icons/icon-512.svg", content: createAppIconSvg(512) },
    {
      path: "/ANDROID_BUILD.md",
      content: `# Android Build Guide

\`\`\`bash
npm install
npm run build
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap add android
npx cap sync android
npx cap open android
\`\`\`

Build APK/AAB inside Android Studio.
`,
    },
  ];
}

function createAppIconSvg(size: number) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><defs><linearGradient id="bg" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#020617"/><stop offset=".55" stop-color="#312e81"/><stop offset="1" stop-color="#0891b2"/></linearGradient><linearGradient id="ship" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#67e8f9"/><stop offset="1" stop-color="#c084fc"/></linearGradient></defs><rect width="${size}" height="${size}" rx="${size * 0.22}" fill="url(#bg)"/><circle cx="${size * 0.72}" cy="${size * 0.24}" r="${size * 0.12}" fill="#facc15" opacity=".9"/><path d="M${size * 0.5} ${size * 0.16} L${size * 0.78} ${size * 0.78} L${size * 0.5} ${size * 0.64} L${size * 0.22} ${size * 0.78} Z" fill="url(#ship)" stroke="white" stroke-width="${size * 0.035}" stroke-linejoin="round"/></svg>`;
}

function createFinalPackagingFiles(input: {
  prompt: string;
  target: string;
  files: VirtualFile[];
  score: any;
}): VirtualFile[] {
  const profile = getTargetProfile(input.target);
  const isAndroid = input.target.includes("android");
  const isGame = input.target.includes("game");
  const paths = new Set(input.files.map((file) => normalizePath(file.path)));
  const additions: VirtualFile[] = [
    {
      path: "/README.md",
      content: `# AutoApp Generated Project

## Purpose

${input.prompt}

## Target

${profile.label} (${input.target})

## Current Quality Score

${input.score?.total || 0}/100

## Included Capabilities

${profile.requiredFeatures.map((item: string) => `- ${item}`).join("\n")}

## Install

\`\`\`bash
npm install
npm run dev
npm run build
\`\`\`

## Deploy

Cloudflare Pages:

\`\`\`txt
Build command: npm run build
Output directory: dist
\`\`\`

${isAndroid ? "## Android\n\nRead `ANDROID_BUILD.md`.\n" : ""}
`,
    },
    {
      path: "/.env.example",
      content: isAndroid
        ? 'VITE_APP_NAME="AutoApp Android App"\nVITE_TARGET_PLATFORM="android"\n'
        : isGame
          ? 'VITE_APP_NAME="AutoApp Game"\nVITE_GAME_MODE="arcade"\n'
          : 'VITE_APP_NAME="AutoApp Generated Project"\n',
    },
    {
      path: "/DEPLOYMENT.md",
      content: `# Deployment Guide

Use GitHub + Cloudflare Pages.

\`\`\`txt
Build command: npm run build
Build output directory: dist
Root directory: /
\`\`\`
`,
    },
    {
      path: "/RELEASE_CHECKLIST.md",
      content: `# Release Checklist

${profile.requiredFeatures.map((item: string) => `- [ ] ${item}`).join("\n")}

- [ ] npm install works
- [ ] npm run build works
- [ ] Mobile layout works
- [ ] Error states are visible
- [ ] SEO metadata is present
`,
    },
  ];

  if (!paths.has("/robots.txt")) {
    additions.push({ path: "/robots.txt", content: "User-agent: *\nAllow: /\nSitemap: /sitemap.xml\n" });
  }

  if (!paths.has("/sitemap.xml")) {
    additions.push({
      path: "/sitemap.xml",
      content:
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>https://example.com/</loc>\n    <priority>1.0</priority>\n  </url>\n</urlset>\n',
    });
  }

  return additions;
}

function createAutonomousReport(input: {
  job: PersistentJob;
  files: VirtualFile[];
  build: any;
  score: any;
  targetProfile: any;
}) {
  const paths = input.files.map((file) => normalizePath(file.path));
  const isAndroid = input.job.target.includes("android");
  const isGame = input.job.target.includes("game");

  const readiness =
    input.build.ok && input.score.total >= 90
      ? "expert_ready"
      : input.build.ok && input.score.total >= 80
        ? "usable"
        : input.build.ok
          ? "needs_polish"
          : "needs_repair";

  const generatedAssets = paths.filter(
    (path) =>
      path.includes("/assets/") ||
      path.includes("/icons/") ||
      path.endsWith(".svg") ||
      path.endsWith(".webmanifest")
  );

  return {
    id: input.job.id,
    prompt: input.job.prompt,
    status: input.job.status,
    phase: input.job.phase,
    target: input.job.target,
    targetLabel: input.targetProfile.label,
    readiness,
    score: input.score,
    build: input.build,
    attempts: {
      current: input.job.attempts,
      max: input.job.max_attempts,
    },
    files: {
      count: input.files.length,
      paths,
      generatedAssets,
      missingRecommendedFiles: (input.targetProfile.recommendedFiles || []).filter((path: string) => !paths.includes(path)),
    },
    capabilities: {
      webApp: true,
      androidReady: isAndroid,
      gameReady: isGame,
      persistentJob: true,
      cronResume: true,
      svgAssets: generatedAssets.length > 0,
      realServerBuild: false,
      apkBuildOnWorker: false,
    },
    deployment: {
      cloudflarePages: {
        buildCommand: "npm run build",
        outputDirectory: "dist",
        rootDirectory: "/",
      },
      android: isAndroid
        ? {
            supported: true,
            method: "Capacitor",
            guideFile: "/ANDROID_BUILD.md",
            commands: [
              "npm install",
              "npm run build",
              "npm install @capacitor/core @capacitor/cli @capacitor/android",
              "npx cap add android",
              "npx cap sync android",
              "npx cap open android",
            ],
          }
        : { supported: false },
    },
    nextActions: buildNextActions(input.score, input.build),
    summary: [
      `Project target: ${input.job.target}.`,
      `Readiness: ${readiness}.`,
      `Score: ${input.score.total}/100.`,
      `Virtual build: ${input.build.ok ? "PASS" : "ISSUES"}.`,
      isGame ? `Game assets generated: ${generatedAssets.length > 0 ? "yes" : "no"}.` : "",
      isAndroid ? "Android packaging: Capacitor-ready. APK/AAB must be built outside Cloudflare Worker." : "",
    ].filter(Boolean).join(" "),
  };
}

async function createPersistentJob(db: D1Database, input: { prompt: string; target?: string }) {
  const now = Date.now();
  const job: PersistentJob = {
    id: crypto.randomUUID(),
    prompt: input.prompt,
    status: "running",
    phase: "product_spec",
    target: input.target || detectTarget(input.prompt),
    score: 0,
    attempts: 0,
    max_attempts: 12,
    files_json: "[]",
    logs_json: JSON.stringify([`${new Date().toISOString()} · Job created.`]),
    error: "",
    created_at: now,
    updated_at: now,
    next_run_at: now,
    last_score: 0,
    stagnant_steps: 0,
    strategy: "normal",
  };

  await db.prepare(
    `INSERT INTO jobs (
      id, prompt, status, phase, target, score, attempts, max_attempts,
      files_json, logs_json, error, created_at, updated_at, next_run_at,
      last_score, stagnant_steps, strategy
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      job.id,
      job.prompt,
      job.status,
      job.phase,
      job.target,
      job.score,
      job.attempts,
      job.max_attempts,
      job.files_json,
      job.logs_json,
      job.error,
      job.created_at,
      job.updated_at,
      job.next_run_at,
      job.last_score,
      job.stagnant_steps,
      job.strategy
    )
    .run();

  return job;
}

async function getPersistentJob(db: D1Database, id: string): Promise<PersistentJob | null> {
  const row = await db.prepare("SELECT * FROM jobs WHERE id = ?").bind(id).first();
  return row ? hydratePersistentJob(row as any) : null;
}

async function listPersistentJobs(db: D1Database) {
  const result = await db.prepare(
    `SELECT id, prompt, status, phase, target, score, attempts, max_attempts,
            error, created_at, updated_at, next_run_at, last_score, stagnant_steps, strategy
     FROM jobs
     ORDER BY updated_at DESC
     LIMIT 30`
  ).all();

  return (result.results || []).map((row: any) => ({
    id: row.id,
    prompt: row.prompt,
    status: row.status,
    phase: row.phase,
    target: row.target,
    score: Number(row.score || 0),
    attempts: Number(row.attempts || 0),
    max_attempts: Number(row.max_attempts || 12),
    error: row.error || "",
    created_at: Number(row.created_at || 0),
    updated_at: Number(row.updated_at || 0),
    next_run_at: Number(row.next_run_at || 0),
    last_score: Number(row.last_score || 0),
    stagnant_steps: Number(row.stagnant_steps || 0),
    strategy: row.strategy || "normal",
  }));
}

async function savePersistentJob(db: D1Database, job: PersistentJob) {
  job.updated_at = Date.now();

  await db.prepare(
    `UPDATE jobs SET
      status = ?, phase = ?, score = ?, attempts = ?, files_json = ?,
      logs_json = ?, error = ?, last_score = ?, stagnant_steps = ?,
      strategy = ?, updated_at = ?, next_run_at = ?
     WHERE id = ?`
  )
    .bind(
      job.status,
      job.phase,
      job.score,
      job.attempts,
      job.files_json,
      job.logs_json,
      job.error || "",
      job.last_score || 0,
      job.stagnant_steps || 0,
      job.strategy || "normal",
      job.updated_at,
      job.next_run_at,
      job.id
    )
    .run();

  return job;
}

function hydratePersistentJob(row: any): PersistentJob {
  return {
    id: String(row.id),
    prompt: String(row.prompt || ""),
    status: row.status || "running",
    phase: row.phase || "product_spec",
    target: row.target || "web-app",
    score: Number(row.score || 0),
    attempts: Number(row.attempts || 0),
    max_attempts: Number(row.max_attempts || 12),
    files_json: String(row.files_json || "[]"),
    logs_json: String(row.logs_json || "[]"),
    error: row.error || "",
    created_at: Number(row.created_at || 0),
    updated_at: Number(row.updated_at || 0),
    next_run_at: Number(row.next_run_at || 0),
    last_score: Number(row.last_score || 0),
    stagnant_steps: Number(row.stagnant_steps || 0),
    strategy: row.strategy || "normal",
  };
}

function publicJob(job: PersistentJob) {
  return {
    id: job.id,
    prompt: job.prompt,
    status: job.status,
    phase: job.phase,
    target: job.target,
    score: job.score,
    attempts: job.attempts,
    max_attempts: job.max_attempts,
    error: job.error || "",
    created_at: job.created_at,
    updated_at: job.updated_at,
    next_run_at: job.next_run_at,
    last_score: job.last_score || 0,
    stagnant_steps: job.stagnant_steps || 0,
    strategy: job.strategy || "normal",
  };
}

function safeJsonArray(value: string | null | undefined) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function createMemoryJob() {
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

function pushMemoryJobLog(id: string, message: string) {
  const job = memoryJobs.get(id);
  if (!job) return;

  job.logs.unshift(`${new Date().toISOString()} · ${message}`);
  job.logs = job.logs.slice(0, 150);
  job.updatedAt = Date.now();
  memoryJobs.set(id, job);
}

function createDeploymentPack(files: VirtualFile[]) {
  const paths = new Set(files.map((file) => normalizePath(file.path)));
  const additions: VirtualFile[] = [];

  if (!paths.has("/README.md")) {
    additions.push({ path: "/README.md", content: "# Generated App\n\nGenerated with AutoApp.\n" });
  }

  if (!paths.has("/.env.example")) {
    additions.push({ path: "/.env.example", content: 'VITE_APP_NAME="Generated App"\n' });
  }

  if (!paths.has("/vercel.json")) {
    additions.push({
      path: "/vercel.json",
      content: JSON.stringify({
        buildCommand: "npm run build",
        outputDirectory: "dist",
        installCommand: "npm install",
        framework: "vite",
        rewrites: [{ source: "/(.*)", destination: "/" }],
      }, null, 2),
    });
  }

  return additions;
}

function createPublishReport(files: VirtualFile[]) {
  const inspection = inspectProject(files);
  const score = scoreProject(files);
  const blockers = [...inspection.missingCriticalFiles];

  return {
    ready: blockers.length === 0 && score.total >= 75,
    score: Math.max(0, score.total - blockers.length * 10),
    qualityScore: score.total,
    blockers,
    warnings: inspection.risks,
    checklist: ["Run dependency resolver.", "Run build check.", "Export ZIP.", "Push to GitHub.", "Deploy on Cloudflare Pages."],
    commands: ["npm install", "npm run build", "git add .", 'git commit -m "Initial AutoApp project"', "git push"],
  };
}

function listTemplates() {
  return [
    createTemplate("saas", "SaaS Starter", "Premium SaaS landing page."),
    createTemplate("dashboard", "Dashboard", "Analytics dashboard."),
    createTemplate("affiliate", "Affiliate Deals", "Affiliate product grid."),
    createTemplate("ai-tool", "AI Tool", "Prompt-based AI tool."),
  ];
}

function createTemplate(id: string, name: string, description: string) {
  return {
    id,
    name,
    description,
    prompt: `Create a premium ${name} application.`,
    files: createFallbackProjectFiles().map((file) =>
      file.path === "/src/App.tsx"
        ? { ...file, content: `export default function App(){return <main className="min-h-screen bg-black p-8 text-white"><h1 className="text-5xl font-black">${name}</h1><p className="mt-4 text-zinc-400">${description}</p></main>}` }
        : file
    ),
  };
}

function createEmptyMemory(projectId: string) {
  return {
    projectId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    architectureNotes: [],
    codingStyle: [],
    recurringProblems: [],
    successfulFixes: [],
    preferredLibraries: [],
    rejectedPatterns: [],
    buildHistory: [],
    aiDecisions: [],
  };
}

function readPackageJson(files: VirtualFile[]) {
  const file = files.find((item) => normalizePath(item.path) === "/package.json");
  if (!file?.content) return null;

  try {
    return JSON.parse(file.content);
  } catch {
    return null;
  }
}

function normalizePackageName(value: string) {
  if (!value || value.startsWith(".") || value.startsWith("/")) return null;

  if (value.startsWith("@")) {
    const parts = value.split("/");
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : value;
  }

  return value.split("/")[0];
}

function sortObject(input: Record<string, any>) {
  return Object.fromEntries(Object.entries(input || {}).sort(([a], [b]) => a.localeCompare(b)));
}

function buildNextActions(score: any, build: any) {
  const actions: string[] = [];

  if (!build.ok) actions.push("Fix all virtual build issues before adding new features.");
  if (score.architecture < 80) actions.push("Improve architecture: add clear base files and structured modules.");
  if (score.productDepth < 80) actions.push("Increase product depth: add real workflows, states and interactions.");
  if (score.ui < 85) actions.push("Upgrade UI to premium level.");
  if (score.mobile < 85) actions.push("Improve mobile-first responsiveness.");
  if (score.reliability < 85) actions.push("Add loading, empty, error and fallback states.");
  if (score.accessibility < 80) actions.push("Improve accessibility.");
  if (score.seo < 75) actions.push("Improve SEO metadata and docs.");
  if (score.monetization < 70) actions.push("Add conversion layer if relevant.");

  if (!actions.length) actions.push("Project is strong. Continue with final user testing and deployment polish.");

  return actions.slice(0, 8);
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runScheduledJobs(env));
  },
};
