import { Hono } from "hono";
import { cors } from "hono/cors";

type Env = {
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

type BuildMode = "none" | "virtual" | "real";

type AiConfig = {
  provider?: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
};

type JobStatus = "queued" | "running" | "success" | "error";

type Job = {
  id: string;
  status: JobStatus;
  createdAt: number;
  updatedAt: number;
  logs: string[];
  result?: unknown;
  error?: string;
};

const app = new Hono<{ Bindings: Env }>();

const jobs = new Map<string, Job>();

app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  })
);

app.get("/api/health", (c) => {
  return c.json({
    ok: true,
    service: "AutoApp API",
    runtime: "cloudflare-workers",
    timestamp: Date.now(),
  });
});

app.post("/api/generate", async (c) => {
  const body = await c.req.json().catch(() => null);

  if (!body?.prompt || typeof body.prompt !== "string") {
    return c.json({ error: "Missing required field: prompt" }, 400);
  }

  const files = cleanFiles(body.currentFiles || []);

  const result = await generateProject({
    env: c.env,
    prompt: body.prompt,
    files,
    aiConfig: body.aiConfig,
    buildMode: body.buildMode || "virtual",
    isAutoImprove: Boolean(body.isAutoImprove),
  });

  return c.json(result);
});

app.post("/api/generate-job", async (c) => {
  const body = await c.req.json().catch(() => null);
  const job = createJob();

  c.executionCtx.waitUntil(
    runJob(job.id, async () => {
      if (!body?.prompt || typeof body.prompt !== "string") {
        throw new Error("Missing required field: prompt");
      }

      pushJobLog(job.id, "Generation started.");

      const result = await generateProject({
        env: c.env,
        prompt: body.prompt,
        files: cleanFiles(body.currentFiles || []),
        aiConfig: body.aiConfig,
        buildMode: body.buildMode || "virtual",
        isAutoImprove: Boolean(body.isAutoImprove),
      });

      pushJobLog(job.id, "Generation completed.");

      return result;
    })
  );

  return c.json({
    ok: true,
    jobId: job.id,
  });
});

app.post("/api/autopilot/run", async (c) => {
  const body = await c.req.json().catch(() => null);
  const job = createJob();

  c.executionCtx.waitUntil(
    runJob(job.id, async () => {
      if (!body?.prompt || typeof body.prompt !== "string") {
        throw new Error("Missing required field: prompt");
      }

      if (!Array.isArray(body.files)) {
        throw new Error("Missing required field: files");
      }

      const targetScore = Number(body.targetScore || 90);
      const maxIterations = Math.max(1, Math.min(5, Number(body.maxIterations || 3)));

      let files = cleanFiles(body.files);
      const iterations: any[] = [];
      const logs: string[] = [];

      for (let index = 1; index <= maxIterations; index++) {
        const previousScore = iterations.at(-1)?.score?.total || 0;

        if (previousScore >= targetScore) {
          break;
        }

        const log = `Autopilot iteration ${index}/${maxIterations}`;
        logs.unshift(`${new Date().toISOString()} · ${log}`);
        pushJobLog(job.id, log);

        const result = await generateProject({
          env: c.env,
          prompt: [
            "Autopilot improvement iteration.",
            "",
            `Original goal: ${body.prompt}`,
            `Previous score: ${previousScore}`,
            `Target score: ${targetScore}`,
            "",
            "Improve the project while preserving existing features.",
            "Return complete changed files only.",
            "Focus on buildability, mobile UX, accessibility, SEO and reliability.",
          ].join("\n"),
          files,
          aiConfig: body.aiConfig,
          buildMode: body.buildMode || "virtual",
          isAutoImprove: true,
        });

        iterations.push(result);
        files = mergeFiles(files, result.files || []);

        if ((result.score?.total || 0) >= targetScore) {
          break;
        }
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

app.get("/api/jobs/:id", (c) => {
  const job = jobs.get(c.req.param("id"));

  if (!job) {
    return c.json({ error: "Job not found" }, 404);
  }

  return c.json(job);
});

app.post("/api/build/check", async (c) => {
  const body = await c.req.json().catch(() => null);
  const files = cleanFiles(body?.files || []);
  const result = virtualBuildCheck(files);

  return c.json(result);
});

app.post("/api/score", async (c) => {
  const body = await c.req.json().catch(() => null);
  const files = cleanFiles(body?.files || []);

  return c.json({
    ok: true,
    score: scoreProject(files),
  });
});

app.post("/api/inspect", async (c) => {
  const body = await c.req.json().catch(() => null);
  const files = cleanFiles(body?.files || []);

  return c.json({
    ok: true,
    inspection: inspectProject(files),
  });
});

app.post("/api/dependencies/resolve", async (c) => {
  const body = await c.req.json().catch(() => null);
  const files = cleanFiles(body?.files || []);
  const resolution = resolveDependencies(files);
  const nextFiles = body?.apply ? applyDependencyResolution(files, resolution.packageJson) : undefined;

  return c.json({
    ok: true,
    resolution,
    files: nextFiles,
  });
});

app.get("/api/templates", (c) => {
  return c.json({
    ok: true,
    templates: listTemplates(),
  });
});

app.post("/api/templates/apply", async (c) => {
  const body = await c.req.json().catch(() => null);
  const template = listTemplates().find((item) => item.id === body?.id);

  if (!template) {
    return c.json({ error: "Template not found" }, 404);
  }

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

app.get("/api/memory/:projectId", (c) => {
  return c.json({
    ok: true,
    memory: createEmptyMemory(c.req.param("projectId")),
  });
});

app.delete("/api/memory/:projectId", (c) => {
  return c.json({
    ok: true,
    memory: createEmptyMemory(c.req.param("projectId")),
  });
});

app.post("/api/preview/start", async (c) => {
  return c.json({
    ok: true,
    session: {
      id: crypto.randomUUID(),
      status: "running",
      url: "",
      logs: [
        "Real preview is disabled on Cloudflare Workers because Workers cannot run npm install or spawn Vite.",
      ],
    },
  });
});

app.get("/api/preview/:id", (c) => {
  return c.json({
    id: c.req.param("id"),
    status: "running",
    url: "",
    logs: [
      "Static preview only on free Cloudflare stack.",
    ],
  });
});

app.delete("/api/preview/:id", (c) => {
  return c.json({
    ok: true,
    session: {
      id: c.req.param("id"),
      status: "stopped",
    },
  });
});

async function runJob(jobId: string, task: () => Promise<unknown>) {
  updateJob(jobId, { status: "running" });

  try {
    const result = await task();

    updateJob(jobId, {
      status: "success",
      result,
    });
  } catch (error: any) {
    updateJob(jobId, {
      status: "error",
      error: error?.message || "Job failed",
    });
  }
}

async function generateProject(params: {
  env: Env;
  prompt: string;
  files: VirtualFile[];
  aiConfig?: AiConfig;
  buildMode?: BuildMode;
  isAutoImprove?: boolean;
}) {
  const plan = await callAiJson(params.env, params.aiConfig, buildPrompt(params));
  const files = normalizeGeneratedFiles(plan?.files || []);
  const merged = mergeFiles(params.files, files);
  const resolved = applyDependencyResolution(merged, resolveDependencies(merged).packageJson);
  const build = virtualBuildCheck(resolved);
  const score = scoreProject(resolved);

  return {
    files: diffFiles(params.files, resolved),
    changelog: String(plan?.changelog || "Generated project files."),
    estimatedTimeSaved: String(plan?.estimatedTimeSaved || "Several hours saved."),
    score,
    nextActions: buildNextActions(score, build),
    mode: build.ok ? (params.files.length ? "improve" : "create") : "repair",
  };
}

function buildPrompt(params: {
  prompt: string;
  files: VirtualFile[];
  isAutoImprove?: boolean;
}) {
  return [
    "You are AutoApp, a production-grade app builder.",
    "Return ONLY valid JSON.",
    "",
    "Required JSON shape:",
    JSON.stringify(
      {
        files: [{ path: "/src/App.tsx", content: "complete file content" }],
        changelog: "summary",
        estimatedTimeSaved: "estimate",
      },
      null,
      2
    ),
    "",
    "Rules:",
    "- Return complete changed files only.",
    "- Never return markdown.",
    "- Never return partial files.",
    "- Keep the app buildable.",
    "- Prefer React + Vite + TypeScript.",
    "- Include package.json when dependencies are needed.",
    "- Preserve existing features when improving.",
    "",
    `Auto improve: ${Boolean(params.isAutoImprove)}`,
    "",
    "User prompt:",
    params.prompt,
    "",
    "Existing files:",
    params.files
      .slice(0, 20)
      .map((file) => `--- ${file.path} ---\n${String(file.content || "").slice(0, 12000)}`)
      .join("\n"),
  ].join("\n");
}

async function callAiJson(env: Env, aiConfig: AiConfig | undefined, prompt: string) {
  const provider = aiConfig?.provider || env.DEFAULT_AI_PROVIDER || "gemini";

  if (provider === "gemini") {
    return callGemini(env, aiConfig, prompt);
  }

  return callOpenAiCompatible(env, aiConfig, prompt);
}

async function callGemini(env: Env, aiConfig: AiConfig | undefined, prompt: string) {
  const key = aiConfig?.apiKey || env.GEMINI_API_KEY;

  if (!key) {
    throw new Error("Missing GEMINI_API_KEY.");
  }

  const model = aiConfig?.model || env.DEFAULT_GEMINI_MODEL || "gemini-2.5-flash";

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
        },
      }),
    }
  );

  const data: any = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || "Gemini request failed.");
  }

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

  return parseJson(text);
}

async function callOpenAiCompatible(env: Env, aiConfig: AiConfig | undefined, prompt: string) {
  const key = aiConfig?.apiKey || env.OPENAI_API_KEY;

  if (!key) {
    throw new Error("Missing OPENAI_API_KEY.");
  }

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
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "Return ONLY valid JSON. No markdown.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  const data: any = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || "OpenAI-compatible request failed.");
  }

  return parseJson(data?.choices?.[0]?.message?.content || "{}");
}

function parseJson(text: string) {
  const cleaned = String(text)
    .trim()
    .replace(/^```json/i, "")
    .replace(/^```/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");

    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }

    throw new Error("AI response is not valid JSON.");
  }
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

  return files
    .filter((file: any) => file?.path)
    .map((file: any) => ({
      path: normalizePath(String(file.path)),
      content: file.content === null ? null : String(file.content || ""),
    }));
}

function mergeFiles(currentFiles: VirtualFile[], changedFiles: VirtualFile[]) {
  const map = new Map<string, VirtualFile>();

  for (const file of currentFiles) {
    map.set(normalizePath(file.path), {
      path: normalizePath(file.path),
      content: file.content,
    });
  }

  for (const file of changedFiles) {
    const path = normalizePath(file.path);

    if (file.content === null) {
      map.delete(path);
      continue;
    }

    map.set(path, {
      path,
      content: file.content,
    });
  }

  return Array.from(map.values()).sort((a, b) => a.path.localeCompare(b.path));
}

function diffFiles(previous: VirtualFile[], next: VirtualFile[]) {
  const previousMap = new Map(previous.map((file) => [normalizePath(file.path), file.content]));

  return next.filter((file) => previousMap.get(normalizePath(file.path)) !== file.content);
}

function normalizePath(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
}

function virtualBuildCheck(files: VirtualFile[]) {
  const logs: string[] = [];
  const paths = new Set(files.map((file) => normalizePath(file.path)));
  const packageFile = files.find((file) => normalizePath(file.path) === "/package.json");

  if (!packageFile?.content) {
    logs.push("Missing /package.json");
  } else {
    try {
      const json = JSON.parse(packageFile.content);

      if (!json.scripts?.build) logs.push("/package.json: missing scripts.build");
      if (!json.dependencies?.react && !json.devDependencies?.react) {
        logs.push("/package.json: Cannot find module 'react'");
      }
    } catch {
      logs.push("/package.json: invalid JSON");
    }
  }

  if (!paths.has("/index.html")) logs.push("Missing /index.html");
  if (!paths.has("/src/main.tsx") && !paths.has("/src/main.jsx")) {
    logs.push("Missing /src/main.tsx");
  }
  if (!paths.has("/src/App.tsx") && !paths.has("/src/App.jsx")) {
    logs.push("Missing /src/App.tsx");
  }

  const issues = logs.map((message) => ({
    type: "unknown",
    message,
    raw: message,
  }));

  return {
    ok: issues.length === 0,
    issues,
    log: logs.join("\n"),
  };
}

function scoreProject(files: VirtualFile[]) {
  const paths = files.map((file) => normalizePath(file.path));
  const all = files.map((file) => file.content || "").join("\n").toLowerCase();

  const architecture =
    20 +
    Number(paths.includes("/package.json")) * 15 +
    Number(paths.includes("/src/App.tsx")) * 15 +
    Number(paths.includes("/src/main.tsx")) * 15 +
    Number(paths.some((path) => path.includes("/components/"))) * 15;

  const ui =
    25 +
    Number(all.includes("rounded")) * 20 +
    Number(all.includes("shadow")) * 20 +
    Number(all.includes("gradient")) * 15;

  const mobile =
    25 +
    Number(all.includes("md:")) * 25 +
    Number(all.includes("grid")) * 15 +
    Number(all.includes("flex")) * 15;

  const seo =
    20 +
    Number(all.includes("description")) * 25 +
    Number(all.includes("og:title")) * 25;

  const accessibility =
    25 +
    Number(all.includes("aria-")) * 25 +
    Number(all.includes("alt=")) * 20 +
    Number(all.includes("label")) * 15;

  const reliability =
    25 +
    Number(all.includes("try")) * 20 +
    Number(all.includes("catch")) * 20 +
    Number(paths.includes("/.env.example")) * 15;

  const performance = 60;
  const maintainability = Math.min(100, 40 + files.length * 2);
  const monetization = Number(all.includes("pricing") || all.includes("checkout")) ? 75 : 35;

  const total = clamp(
    architecture * 0.16 +
      reliability * 0.16 +
      maintainability * 0.14 +
      mobile * 0.12 +
      ui * 0.12 +
      performance * 0.1 +
      accessibility * 0.08 +
      seo * 0.07 +
      monetization * 0.05
  );

  return {
    ui: clamp(ui),
    mobile: clamp(mobile),
    performance: clamp(performance),
    accessibility: clamp(accessibility),
    seo: clamp(seo),
    maintainability: clamp(maintainability),
    architecture: clamp(architecture),
    monetization: clamp(monetization),
    reliability: clamp(reliability),
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
    language: paths.some((path) => path.endsWith(".ts") || path.endsWith(".tsx"))
      ? "TypeScript"
      : "JavaScript",
    packageManager: "npm",
    dependencies,
    devDependencies,
    entrypoints: paths.filter((path) =>
      ["/index.html", "/src/main.tsx", "/src/App.tsx", "/app/page.tsx"].includes(path)
    ),
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

  const packageJson = readPackageJson(files) || {
    name: "generated-app",
    private: true,
    version: "1.0.0",
    type: "module",
    scripts: {
      dev: "vite",
      build: "vite build",
      preview: "vite preview",
    },
    dependencies: {},
    devDependencies: {},
  };

  packageJson.dependencies ||= {};
  packageJson.devDependencies ||= {};
  packageJson.dependencies.react ||= "latest";
  packageJson.dependencies["react-dom"] ||= "latest";
  packageJson.devDependencies.vite ||= "latest";
  packageJson.devDependencies.typescript ||= "latest";
  packageJson.devDependencies["@vitejs/plugin-react"] ||= "latest";

  const declared = new Set([
    ...Object.keys(packageJson.dependencies),
    ...Object.keys(packageJson.devDependencies),
  ]);

  const missing = Array.from(used).filter((pkg) => !declared.has(pkg));

  for (const pkg of missing) {
    packageJson.dependencies[pkg] = "latest";
  }

  return {
    ok: missing.length === 0,
    packageJsonFound: true,
    usedPackages: Array.from(used),
    declaredDependencies: Array.from(new Set([...declared, ...missing])),
    missingDependencies: missing,
    packageJson: JSON.stringify(packageJson, null, 2),
    warnings: [],
  };
}

function applyDependencyResolution(files: VirtualFile[], packageJson?: string) {
  const next = mergeFiles(files, [
    {
      path: "/package.json",
      content: packageJson || resolveDependencies(files).packageJson || "",
    },
  ]);

  return next;
}

function createDeploymentPack(files: VirtualFile[]) {
  const paths = new Set(files.map((file) => normalizePath(file.path)));
  const additions: VirtualFile[] = [];

  if (!paths.has("/README.md")) {
    additions.push({
      path: "/README.md",
      content: "# Generated App\n\nGenerated with AutoApp.\n",
    });
  }

  if (!paths.has("/.env.example")) {
    additions.push({
      path: "/.env.example",
      content: 'VITE_APP_NAME="Generated App"\n',
    });
  }

  if (!paths.has("/vercel.json")) {
    additions.push({
      path: "/vercel.json",
      content: JSON.stringify(
        {
          buildCommand: "npm run build",
          outputDirectory: "dist",
          installCommand: "npm install",
          framework: "vite",
          rewrites: [{ source: "/(.*)", destination: "/" }],
        },
        null,
        2
      ),
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
    checklist: [
      "Run dependency resolver.",
      "Run build check.",
      "Export ZIP.",
      "Push to GitHub.",
      "Deploy on Cloudflare Pages.",
    ],
    commands: [
      "npm install",
      "npm run build",
      "git add .",
      'git commit -m "Initial AutoApp project"',
      "git push",
    ],
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
    files: [
      {
        path: "/package.json",
        content: JSON.stringify(
          {
            name: id,
            version: "1.0.0",
            private: true,
            type: "module",
            scripts: {
              dev: "vite",
              build: "vite build",
              preview: "vite preview",
            },
            dependencies: {
              react: "latest",
              "react-dom": "latest",
              "@tailwindcss/vite": "latest",
              "lucide-react": "latest",
            },
            devDependencies: {
              vite: "latest",
              typescript: "latest",
              "@vitejs/plugin-react": "latest",
            },
          },
          null,
          2
        ),
      },
      {
        path: "/index.html",
        content:
          '<!doctype html><html><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>',
      },
      {
        path: "/src/main.tsx",
        content:
          'import React from "react";\nimport ReactDOM from "react-dom/client";\nimport App from "./App";\nimport "./style.css";\n\nReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);\n',
      },
      {
        path: "/src/App.tsx",
        content:
          'export default function App() {\n  return <main className="min-h-screen bg-black p-8 text-white"><h1 className="text-5xl font-black">' +
          name +
          "</h1></main>;\n}\n",
      },
      {
        path: "/src/style.css",
        content: '@import "tailwindcss";\n',
      },
      {
        path: "/vite.config.ts",
        content:
          'import { defineConfig } from "vite";\nimport react from "@vitejs/plugin-react";\nimport tailwindcss from "@tailwindcss/vite";\n\nexport default defineConfig({ plugins: [react(), tailwindcss()] });\n',
      },
    ],
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

function buildNextActions(score: any, build: any) {
  const actions: string[] = [];

  if (!build.ok) actions.push("Fix remaining build issues before publishing.");
  if (score.architecture < 85) actions.push("Improve project architecture.");
  if (score.ui < 85) actions.push("Improve visual hierarchy and UI polish.");
  if (score.mobile < 85) actions.push("Improve mobile-first responsive layout.");
  if (score.seo < 75) actions.push("Improve SEO metadata.");
  if (score.accessibility < 75) actions.push("Improve accessibility.");

  if (!actions.length) {
    actions.push("Project is close to publish-ready.");
  }

  return actions;
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export default app;
