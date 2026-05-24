export default {
  async fetch(request, env, ctx) {
    return handleRequest(request, env, ctx);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(runScheduledJobs(env));
  }
};

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
  "done"
];

async function handleRequest(request, env) {
  const url = new URL(request.url);

  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders()
    });
  }

  try {
    if (url.pathname === "/api/health") {
      return json({
        ok: true,
        service: "AutoApp API",
        runtime: "cloudflare-worker",
        timestamp: Date.now()
      });
    }

    if (url.pathname === "/api/jobs" && request.method === "GET") {
      const jobs = await listPersistentJobs(env.DB);

      return json({
        ok: true,
        jobs
      });
    }

    if (url.pathname === "/api/jobs/create" && request.method === "POST") {
      const body = await request.json();

      const job = await createPersistentJob(env.DB, {
        prompt: body.prompt
      });

      return json({
        ok: true,
        jobId: job.id
      });
    }

    if (
      url.pathname.match(/^\/api\/jobs\/[^/]+\/step$/) &&
      request.method === "POST"
    ) {
      const id = url.pathname.split("/")[3];

      const job = await runPersistentJobStep(env, id);

      return json({
        ok: true,
        job
      });
    }

    if (
      url.pathname.match(/^\/api\/jobs\/[^/]+\/resume$/) &&
      request.method === "POST"
    ) {
      const id = url.pathname.split("/")[3];

      const job = await getPersistentJob(env.DB, id);

      if (!job) {
        return json({ error: "Job not found" }, 404);
      }

      job.status = "running";
      job.next_run_at = Date.now();

      await savePersistentJob(env.DB, job);

      return json({
        ok: true,
        job
      });
    }

    if (
      url.pathname.match(/^\/api\/jobs\/[^/]+\/files$/) &&
      request.method === "GET"
    ) {
      const id = url.pathname.split("/")[3];

      const job = await getPersistentJob(env.DB, id);

      if (!job) {
        return json({ error: "Job not found" }, 404);
      }

      return json({
        ok: true,
        jobId: job.id,
        files: safeJsonArray(job.files_json),
        phase: job.phase,
        score: job.score,
        status: job.status
      });
    }

    if (
      url.pathname.match(/^\/api\/jobs\/[^/]+\/report$/) &&
      request.method === "GET"
    ) {
      const id = url.pathname.split("/")[3];

      const job = await getPersistentJob(env.DB, id);

      if (!job) {
        return json({ error: "Job not found" }, 404);
      }

      const files = safeJsonArray(job.files_json);
      const build = virtualBuildCheck(files);
      const score = scoreProject(files);

      const report = createAutonomousReport({
        job,
        files,
        build,
        score,
        targetProfile: getTargetProfile(job.target)
      });

      return json({
        ok: true,
        report
      });
    }

    return json({
      ok: true,
      message: "AutoApp API Worker running"
    });
  } catch (error) {
    return json({
      ok: false,
      error: String(error?.message || error)
    }, 500);
  }
}

async function runScheduledJobs(env) {
  const jobs = await listPersistentJobs(env.DB);

  for (const job of jobs) {
    if (job.status !== "running") continue;

    if (Number(job.next_run_at || 0) > Date.now()) continue;

    try {
      await runPersistentJobStep(env, job.id);
    } catch (err) {
      console.error(err);
    }
  }
}

async function createPersistentJob(db, input) {
  const target = detectTarget(input.prompt);

  const job = {
    id: crypto.randomUUID(),
    prompt: input.prompt,
    status: "running",
    phase: "product_spec",
    target,
    score: 0,
    attempts: 0,
    max_attempts: 12,
    files_json: "[]",
    logs_json: "[]",
    error: null,
    created_at: Date.now(),
    updated_at: Date.now(),
    next_run_at: Date.now(),
    last_score: 0,
    stagnant_steps: 0,
    strategy: "normal"
  };

  await db.prepare(`
    INSERT INTO jobs (
      id,
      prompt,
      status,
      phase,
      target,
      score,
      attempts,
      max_attempts,
      files_json,
      logs_json,
      error,
      created_at,
      updated_at,
      next_run_at,
      last_score,
      stagnant_steps,
      strategy
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
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

async function savePersistentJob(db, job) {
  await db.prepare(`
    UPDATE jobs SET
      prompt = ?,
      status = ?,
      phase = ?,
      target = ?,
      score = ?,
      attempts = ?,
      max_attempts = ?,
      files_json = ?,
      logs_json = ?,
      error = ?,
      last_score = ?,
      stagnant_steps = ?,
      strategy = ?,
      updated_at = ?,
      next_run_at = ?
    WHERE id = ?
  `)
  .bind(
    job.prompt,
    job.status,
    job.phase,
    job.target,
    job.score,
    job.attempts,
    job.max_attempts,
    JSON.stringify(job.files || []),
    JSON.stringify(job.logs || []),
    job.error || null,
    job.last_score || 0,
    job.stagnant_steps || 0,
    job.strategy || "normal",
    Date.now(),
    job.next_run_at,
    job.id
  )
  .run();

  return job;
}

async function getPersistentJob(db, id) {
  const result = await db
    .prepare(`SELECT * FROM jobs WHERE id = ?`)
    .bind(id)
    .first();

  if (!result) return null;

  return hydrateJob(result);
}

async function listPersistentJobs(db) {
  const result = await db
    .prepare(`SELECT * FROM jobs ORDER BY updated_at DESC`)
    .all();

  return (result.results || []).map(hydrateJob);
}

function hydrateJob(row) {
  return {
    ...row,
    files: safeJsonArray(row.files_json),
    logs: safeJsonArray(row.logs_json)
  };
}

async function runPersistentJobStep(env, id) {
  const job = await getPersistentJob(env.DB, id);

  if (!job) {
    throw new Error("Job not found");
  }

  if (job.status === "done") {
    return job;
  }

  job.attempts += 1;

  const phase = job.phase;

  let files = safeJsonArray(job.files_json);

  const build = virtualBuildCheck(files);
  const previousScoreObject = scoreProject(files);

  const prompt = buildPhasePrompt({
    phase,
    prompt: job.prompt,
    target: job.target,
    files,
    score: previousScoreObject,
    build,
    strategy: job.strategy || "normal"
  });

  const generatedFiles = await generateFilesFromAI(env, {
    prompt
  });

  let nextFiles = mergeFiles(files, generatedFiles);

  if (job.target.includes("android")) {
    nextFiles = mergeFiles(
      nextFiles,
      createAndroidCapacitorFiles(job.prompt)
    );
  }

  const score = scoreProject(nextFiles);

  const previousScore = Number(job.score || job.last_score || 0);
  const improvement = score.total - previousScore;

  job.last_score = previousScore;

  if (improvement <= 1) {
    job.stagnant_steps = Number(job.stagnant_steps || 0) + 1;
  } else {
    job.stagnant_steps = 0;
  }

  job.strategy = chooseNextStrategy({
    job,
    phase,
    build,
    score,
    improvement
  });

  if (phase === "final_packaging") {
    nextFiles = mergeFiles(
      nextFiles,
      createFinalPackagingFiles({
        prompt: job.prompt,
        target: job.target,
        files: nextFiles,
        score
      })
    );
  }

  const nextBuild = virtualBuildCheck(nextFiles);

  job.score = score.total;
  job.files = nextFiles;

  job.logs = [
    `Phase ${phase} completed`,
    `Score ${score.total}/100`,
    `Strategy ${job.strategy}`
  ];

  job.phase = getNextPhaseWithStrategy({
    phase,
    build: nextBuild,
    score,
    job
  });

  if (job.phase === "done") {
    job.status = "done";
  }

  if (job.attempts >= job.max_attempts && job.status !== "done") {
    job.status = "paused";
  }

  job.next_run_at = Date.now() + 1000 * 60 * 5;

  await savePersistentJob(env.DB, job);

  return job;
      }

function chooseNextStrategy({
  job,
  phase,
  build,
  score,
  improvement
}) {
  if (!build.ok) return "repair";

  if (Number(job.stagnant_steps || 0) >= 3) {
    if (score.productDepth < 80) return "force_product_depth";
    if (score.ui < 85) return "force_ui";
    if (score.mobile < 85) return "force_mobile";
    if (score.reliability < 85) return "force_reliability";
    if (score.seo < 75) return "force_seo";
    return "finalize";
  }

  if (improvement >= 5) return "normal";

  if (phase === "sprites_and_assets") return "force_assets";
  if (phase === "animations_and_feedback") return "force_feedback";
  if (phase === "final_packaging") return "finalize";

  return job.strategy || "normal";
}

function getNextPhaseWithStrategy({
  phase,
  build,
  score,
  job
}) {
  if (!build.ok) return "repair";

  const strategy = job.strategy || "normal";

  if (score.total >= 92 && build.ok) {
    return "done";
  }

  if (strategy === "force_product_depth") {
    return "core_features";
  }

  if (strategy === "force_ui") {
    return "ui_system";
  }

  if (strategy === "force_mobile") {
    return "ui_system";
  }

  if (strategy === "force_reliability") {
    return "animations_and_feedback";
  }

  if (strategy === "force_seo") {
    return "launch_pack";
  }

  if (strategy === "force_assets") {
    return "sprites_and_assets";
  }

  if (strategy === "force_feedback") {
    return "animations_and_feedback";
  }

  if (strategy === "repair") {
    return "repair";
  }

  if (strategy === "finalize" && score.total >= 82) {
    return "final_packaging";
  }

  const index = AUTONOMOUS_PHASES.indexOf(phase);

  if (index < 0) {
    return "product_spec";
  }

  return AUTONOMOUS_PHASES[
    Math.min(index + 1, AUTONOMOUS_PHASES.length - 1)
  ];
}

function buildPhasePrompt({
  phase,
  prompt,
  target,
  files,
  score,
  build,
  strategy
}) {
  const targetProfile = getTargetProfile(target);

  return [
    "You are AutoApp autonomous software generation engine.",
    "",
    "GOAL:",
    prompt,
    "",
    "TARGET:",
    target,
    "",
    "TARGET PROFILE:",
    JSON.stringify(targetProfile, null, 2),
    "",
    "CURRENT STRATEGY:",
    strategy || "normal",
    "",
    "STRATEGY NOTE:",
    getStrategyInstruction(strategy),
    "",
    "CURRENT SCORE:",
    JSON.stringify(score, null, 2),
    "",
    "BUILD STATUS:",
    JSON.stringify(build, null, 2),
    "",
    "CURRENT FILES:",
    JSON.stringify(files.slice(0, 25), null, 2),
    "",
    "CURRENT PHASE:",
    phase,
    "",
    "PHASE INSTRUCTION:",
    getPhaseInstruction(phase),
    "",
    "RETURN:",
    "Return ONLY a JSON array of files:",
    `[{"path":"/src/App.tsx","content":"..."}]`
  ].join("\n");
}

function getPhaseInstruction(phase) {
  const map = {
    product_spec:
      "Define the product architecture, goals, user flows and core requirements.",

    architecture:
      "Create production-grade architecture and filesystem structure.",

    base_files:
      "Create base Vite/React/Tailwind files and configs.",

    ui_system:
      "Improve premium UI, mobile-first layouts, cards, hierarchy and responsive UX.",

    core_features:
      "Implement deep product features, interactions, states and workflows.",

    gameplay_or_business_logic:
      "Implement gameplay systems or business logic with realistic flows.",

    sprites_and_assets:
      "Generate local SVG, CSS and canvas assets, sprites and icons.",

    animations_and_feedback:
      "Improve transitions, animations, micro-feedback and UX responsiveness.",

    virtual_build:
      "Fix imports, syntax, dependencies and ensure virtual build passes.",

    repair:
      "Repair runtime, dependency, import and structural issues.",

    launch_pack:
      "Add deployment, SEO, robots, sitemap, metadata and launch assets.",

    final_packaging:
      "Create final delivery package, README, env example, manifests and deployment docs.",

    final_audit:
      "Perform final production audit and polish."
  };

  return map[phase] || "Improve the project.";
}

function getStrategyInstruction(strategy) {
  const map = {
    force_product_depth:
      "Focus on deeper real product workflows, states, interactions and user value.",

    force_ui:
      "Focus on premium UI quality, spacing, hierarchy and polish.",

    force_mobile:
      "Focus on mobile-first ergonomics and responsive layout.",

    force_reliability:
      "Focus on loading, empty, error and recovery states.",

    force_seo:
      "Focus on SEO metadata, sitemap, robots and launch documentation.",

    force_assets:
      "Focus on stronger local assets, sprites and visual quality.",

    force_feedback:
      "Focus on animation, transitions and interaction feel.",

    repair:
      "Focus only on fixing build/import/dependency issues.",

    finalize:
      "Focus on release readiness and deployment packaging."
  };

  return map[strategy] || "Normal improvement strategy.";
}

function detectTarget(prompt = "") {
  const lower = prompt.toLowerCase();

  if (
    lower.includes("android") &&
    (lower.includes("game") || lower.includes("jeu"))
  ) {
    return "android-web-game";
  }

  if (lower.includes("android")) {
    return "android-capacitor";
  }

  if (lower.includes("game") || lower.includes("jeu")) {
    return "web-game";
  }

  if (lower.includes("trading")) {
    return "trading";
  }

  if (lower.includes("affiliate")) {
    return "affiliate";
  }

  if (lower.includes("saas")) {
    return "saas";
  }

  if (lower.includes("dashboard")) {
    return "dashboard";
  }

  if (lower.includes("ecommerce")) {
    return "ecommerce";
  }

  if (lower.includes("ai")) {
    return "ai-tool";
  }

  return "web-app";
}

function getTargetProfile(target) {
  const profiles = {
    "web-game": {
      label: "Web Game",
      requiredFeatures: [
        "game loop",
        "controls",
        "score",
        "restart",
        "responsive mobile layout"
      ]
    },

    "android-web-game": {
      label: "Android Web Game",
      requiredFeatures: [
        "game loop",
        "android-ready",
        "touch controls",
        "responsive layout",
        "mobile performance"
      ]
    },

    saas: {
      label: "SaaS",
      requiredFeatures: [
        "dashboard",
        "auth-ready UI",
        "pricing",
        "settings",
        "responsive UX"
      ]
    },

    trading: {
      label: "Trading Platform",
      requiredFeatures: [
        "market cards",
        "signals",
        "charts",
        "mobile UX",
        "risk management"
      ]
    },

    affiliate: {
      label: "Affiliate App",
      requiredFeatures: [
        "cards",
        "SEO",
        "responsive grid",
        "product pages",
        "CTA buttons"
      ]
    },

    "ai-tool": {
      label: "AI Tool",
      requiredFeatures: [
        "prompt UI",
        "AI responses",
        "loading states",
        "history",
        "responsive UX"
      ]
    },

    "web-app": {
      label: "Web App",
      requiredFeatures: [
        "responsive UI",
        "navigation",
        "states",
        "mobile-first",
        "modern UX"
      ]
    }
  };

  return profiles[target] || profiles["web-app"];
}

function virtualBuildCheck(files) {
  const issues = [];

  const paths = files.map((file) => normalizePath(file.path));

  if (!paths.includes("/package.json")) {
    issues.push({
      file: "/package.json",
      message: "Missing package.json"
    });
  }

  if (
    !paths.includes("/src/App.tsx") &&
    !paths.includes("/src/main.tsx")
  ) {
    issues.push({
      file: "/src",
      message: "Missing React entry files"
    });
  }

  for (const file of files) {
    if (
      file.path.endsWith(".json")
    ) {
      try {
        JSON.parse(file.content);
      } catch {
        issues.push({
          file: file.path,
          message: "Invalid JSON"
        });
      }
    }

    if (
      file.content.includes("<<<<<<<") ||
      file.content.includes(">>>>>>")
    ) {
      issues.push({
        file: file.path,
        message: "Git conflict markers found"
      });
    }
  }

  return {
    ok: issues.length === 0,
    issues
  };
}

function scoreProject(files) {
  const paths = files.map((file) =>
    normalizePath(file.path).toLowerCase()
  );

  let ui = 50;
  let productDepth = 50;
  let mobile = 50;
  let reliability = 50;
  let seo = 50;

  if (paths.includes("/src/app.tsx")) ui += 10;
  if (paths.includes("/package.json")) reliability += 10;
  if (paths.includes("/readme.md")) seo += 10;
  if (paths.includes("/robots.txt")) seo += 10;
  if (paths.includes("/sitemap.xml")) seo += 10;

  if (
    files.some((f) => f.content.includes("loading"))
  ) {
    reliability += 10;
  }

  if (
    files.some((f) => f.content.includes("mobile"))
  ) {
    mobile += 10;
  }

  if (
    files.some((f) => f.content.includes("score"))
  ) {
    productDepth += 10;
  }

  if (
    files.some((f) => f.content.includes("animation"))
  ) {
    ui += 10;
  }

  ui = Math.min(ui, 100);
  productDepth = Math.min(productDepth, 100);
  mobile = Math.min(mobile, 100);
  reliability = Math.min(reliability, 100);
  seo = Math.min(seo, 100);

  const total = Math.round(
    (ui + productDepth + mobile + reliability + seo) / 5
  );

  return {
    total,
    ui,
    productDepth,
    mobile,
    reliability,
    seo
  };
    }

async function generateFilesFromAI(env, { prompt }) {
  const apiKey = env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY");
  }

  const model = env.DEFAULT_GEMINI_MODEL || "gemini-2.5-flash";

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.25,
          responseMimeType: "application/json"
        }
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || "Gemini request failed");
  }

  const text =
    data?.candidates?.[0]?.content?.parts?.[0]?.text ||
    "[]";

  return normalizeGeneratedFiles(parseAiFiles(text));
}

function parseAiFiles(text) {
  const cleaned = String(text || "")
    .trim()
    .replace(/^```json/i, "")
    .replace(/^```/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned);

    if (Array.isArray(parsed)) return parsed;

    if (Array.isArray(parsed.files)) return parsed.files;

    return [];
  } catch {
    const startArray = cleaned.indexOf("[");
    const endArray = cleaned.lastIndexOf("]");

    if (startArray >= 0 && endArray > startArray) {
      try {
        return JSON.parse(cleaned.slice(startArray, endArray + 1));
      } catch {
        return createFallbackProjectFiles();
      }
    }

    const startObject = cleaned.indexOf("{");
    const endObject = cleaned.lastIndexOf("}");

    if (startObject >= 0 && endObject > startObject) {
      try {
        const parsed = JSON.parse(cleaned.slice(startObject, endObject + 1));

        if (Array.isArray(parsed)) return parsed;
        if (Array.isArray(parsed.files)) return parsed.files;
      } catch {
        return createFallbackProjectFiles();
      }
    }

    return createFallbackProjectFiles();
  }
}

function normalizeGeneratedFiles(files) {
  if (!Array.isArray(files)) return [];

  const seen = new Set();

  return files
    .filter((file) => file && file.path)
    .map((file) => ({
      path: normalizePath(file.path),
      content: file.content === null ? null : String(file.content || "")
    }))
    .filter((file) => {
      if (seen.has(file.path)) return false;
      seen.add(file.path);
      return true;
    });
}

function createFallbackProjectFiles() {
  return [
    {
      path: "/package.json",
      content: JSON.stringify(
        {
          name: "autoapp-generated-project",
          version: "1.0.0",
          private: true,
          type: "module",
          scripts: {
            dev: "vite",
            build: "vite build",
            preview: "vite preview"
          },
          dependencies: {
            "@tailwindcss/vite": "latest",
            react: "latest",
            "react-dom": "latest"
          },
          devDependencies: {
            "@vitejs/plugin-react": "latest",
            typescript: "latest",
            vite: "latest"
          }
        },
        null,
        2
      )
    },
    {
      path: "/index.html",
      content:
        '<!doctype html><html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>AutoApp Generated Project</title><meta name="description" content="Generated with AutoApp." /></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>'
    },
    {
      path: "/vite.config.ts",
      content:
        'import { defineConfig } from "vite";\nimport react from "@vitejs/plugin-react";\nimport tailwindcss from "@tailwindcss/vite";\n\nexport default defineConfig({ plugins: [react(), tailwindcss()] });\n'
    },
    {
      path: "/tsconfig.json",
      content: JSON.stringify(
        {
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
            jsx: "react-jsx"
          },
          include: ["src"]
        },
        null,
        2
      )
    },
    {
      path: "/src/main.tsx",
      content:
        'import React from "react";\nimport ReactDOM from "react-dom/client";\nimport App from "./App";\nimport "./style.css";\n\nReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);\n'
    },
    {
      path: "/src/App.tsx",
      content:
        'export default function App() {\n  return (\n    <main className="min-h-screen bg-[#050505] px-6 py-16 text-white">\n      <section className="mx-auto max-w-5xl rounded-3xl border border-white/10 bg-white/[0.04] p-8 shadow-2xl">\n        <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">AutoApp</p>\n        <h1 className="mt-4 text-5xl font-black tracking-tight md:text-7xl">Generated app recovered safely.</h1>\n        <p className="mt-6 max-w-2xl text-zinc-400">The AI response was invalid, so AutoApp generated a safe buildable fallback project.</p>\n      </section>\n    </main>\n  );\n}\n'
    },
    {
      path: "/src/style.css",
      content:
        '@import "tailwindcss";\n\n* { box-sizing: border-box; }\nbody { margin: 0; background: #050505; color: white; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }\n'
    }
  ];
}

function mergeFiles(currentFiles, changedFiles) {
  const map = new Map();

  for (const file of currentFiles || []) {
    map.set(normalizePath(file.path), {
      path: normalizePath(file.path),
      content: file.content
    });
  }

  for (const file of changedFiles || []) {
    const path = normalizePath(file.path);

    if (file.content === null) {
      map.delete(path);
    } else {
      map.set(path, {
        path,
        content: file.content
      });
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    a.path.localeCompare(b.path)
  );
}

function safeJsonArray(value) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizePath(path) {
  const value = String(path || "").trim();
  return value.startsWith("/") ? value : `/${value}`;
}

function createAndroidCapacitorFiles(prompt) {
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
  server: {
    androidScheme: "https"
  }
};

export default config;
`
    },
    {
      path: "/manifest.webmanifest",
      content: JSON.stringify(
        {
          name: "AutoApp Generated Game",
          short_name: "AutoGame",
          description:
            "A mobile-first Android-ready game generated by AutoApp.",
          start_url: "/",
          display: "standalone",
          background_color: "#020617",
          theme_color: "#020617",
          orientation: "portrait",
          icons: [
            {
              src: "/icons/icon-192.svg",
              sizes: "192x192",
              type: "image/svg+xml",
              purpose: "any maskable"
            },
            {
              src: "/icons/icon-512.svg",
              sizes: "512x512",
              type: "image/svg+xml",
              purpose: "any maskable"
            }
          ]
        },
        null,
        2
      )
    },
    {
      path: "/public/icons/icon-192.svg",
      content: createAppIconSvg(192)
    },
    {
      path: "/public/icons/icon-512.svg",
      content: createAppIconSvg(512)
    },
    {
      path: "/ANDROID_BUILD.md",
      content: `# Android Build Guide

This project is Android-ready through Capacitor.

## Requirements

- Node.js 20+
- Android Studio
- Java JDK 17+
- Android SDK installed

## Install

\`\`\`bash
npm install
\`\`\`

## Build web app

\`\`\`bash
npm run build
\`\`\`

## Add Android platform

\`\`\`bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap add android
\`\`\`

## Sync web build to Android

\`\`\`bash
npx cap sync android
\`\`\`

## Open Android Studio

\`\`\`bash
npx cap open android
\`\`\`

## Build APK / AAB

In Android Studio:

\`\`\`txt
Build → Generate Signed Bundle / APK
\`\`\`
`
    }
  ];
}

function createAppIconSvg(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop stop-color="#020617"/>
      <stop offset=".55" stop-color="#312e81"/>
      <stop offset="1" stop-color="#0891b2"/>
    </linearGradient>
    <linearGradient id="ship" x1="0" x2="1" y1="0" y2="1">
      <stop stop-color="#67e8f9"/>
      <stop offset="1" stop-color="#c084fc"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${size * 0.22}" fill="url(#bg)"/>
  <circle cx="${size * 0.72}" cy="${size * 0.24}" r="${size * 0.12}" fill="#facc15" opacity=".9"/>
  <path d="M${size * 0.5} ${size * 0.16} L${size * 0.78} ${size * 0.78} L${size * 0.5} ${size * 0.64} L${size * 0.22} ${size * 0.78} Z" fill="url(#ship)" stroke="white" stroke-width="${size * 0.035}" stroke-linejoin="round"/>
</svg>`;
}

function createFinalPackagingFiles({
  prompt,
  target,
  files,
  score
}) {
  const profile = getTargetProfile(target);
  const isAndroid = target.includes("android");
  const isGame = target.includes("game");
  const paths = files.map((file) => normalizePath(file.path));

  const additions = [
    {
      path: "/README.md",
      content: createFinalReadme({
        prompt,
        target,
        profile,
        score,
        isAndroid,
        isGame
      })
    },
    {
      path: "/.env.example",
      content: createFinalEnvExample(target)
    },
    {
      path: "/DEPLOYMENT.md",
      content: createDeploymentGuide({
        isAndroid,
        isGame
      })
    },
    {
      path: "/RELEASE_CHECKLIST.md",
      content: createReleaseChecklist({
        target,
        profile,
        isAndroid,
        isGame
      })
    }
  ];

  if (!paths.includes("/robots.txt")) {
    additions.push({
      path: "/robots.txt",
      content: "User-agent: *\nAllow: /\nSitemap: /sitemap.xml\n"
    });
  }

  if (!paths.includes("/sitemap.xml")) {
    additions.push({
      path: "/sitemap.xml",
      content:
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>https://example.com/</loc>\n    <priority>1.0</priority>\n  </url>\n</urlset>\n'
    });
  }

  if (isAndroid) {
    additions.push(...createAndroidCapacitorFiles(prompt));
  }

  return additions;
}

function createFinalReadme({
  prompt,
  target,
  profile,
  score,
  isAndroid,
  isGame
}) {
  return `# AutoApp Generated Project

## Purpose

${prompt}

## Target

${profile.label} (${target})

## Current Quality Score

${score?.total || 0}/100

## Included Capabilities

${profile.requiredFeatures.map((item) => `- ${item}`).join("\n")}

## Project Type

${isGame ? "- Game-ready project with gameplay, scoring, feedback and assets." : "- Web application project."}
${isAndroid ? "- Android-ready through Capacitor." : "- Web deployment-ready."}

## Install

\`\`\`bash
npm install
\`\`\`

## Development

\`\`\`bash
npm run dev
\`\`\`

## Build

\`\`\`bash
npm run build
\`\`\`

## Deploy on Cloudflare Pages

\`\`\`txt
Build command: npm run build
Build output directory: dist
Root directory: /
\`\`\`

${isAndroid ? "## Android Build\n\nRead ANDROID_BUILD.md.\n" : ""}

Generated autonomously by AutoApp.
`;
}

function createFinalEnvExample(target) {
  if (target === "ai-tool") {
    return `VITE_APP_NAME="AutoApp Generated AI Tool"
VITE_API_BASE_URL=""
VITE_DEFAULT_MODEL="gemini-2.5-flash"
`;
  }

  if (target.includes("android")) {
    return `VITE_APP_NAME="AutoApp Android App"
VITE_TARGET_PLATFORM="android"
`;
  }

  if (target.includes("game")) {
    return `VITE_APP_NAME="AutoApp Game"
VITE_GAME_MODE="arcade"
`;
  }

  return `VITE_APP_NAME="AutoApp Generated Project"
`;
}

function createDeploymentGuide({
  isAndroid,
  isGame
}) {
  return `# Deployment Guide

## Web Deployment

Use GitHub + Cloudflare Pages.

Settings:

\`\`\`txt
Build command: npm run build
Build output directory: dist
Root directory: /
\`\`\`

${isGame ? "## Game Notes\n\nLocal game assets should be stored in /src/assets.\n" : ""}

${
  isAndroid
    ? `## Android Notes

Cloudflare Workers cannot build APK/AAB files.

\`\`\`bash
npm install
npm run build
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap add android
npx cap sync android
npx cap open android
\`\`\`
`
    : "Android packaging is not enabled for this target."
}
`;
}

function createReleaseChecklist({
  target,
  profile,
  isAndroid,
  isGame
}) {
  return `# Release Checklist

## Target

${profile.label} (${target})

## Required Feature Checks

${profile.requiredFeatures.map((item) => `- [ ] ${item}`).join("\n")}

## Quality Checks

- [ ] npm install works
- [ ] npm run build works
- [ ] Main user flow works
- [ ] Mobile layout works
- [ ] Error states are visible
- [ ] SEO metadata is present

${isGame ? "- [ ] Game controls work\n- [ ] Score updates correctly\n- [ ] Restart works\n" : ""}
${isAndroid ? "- [ ] Capacitor config exists\n- [ ] Android Studio opens project\n- [ ] APK/AAB builds successfully\n" : ""}
`;
}

function createAutonomousReport({
  job,
  files,
  build,
  score,
  targetProfile
}) {
  const paths = files.map((file) => normalizePath(file.path));
  const isAndroid = String(job.target || "").includes("android");
  const isGame = String(job.target || "").includes("game");

  const readiness =
    build.ok && score.total >= 90
      ? "expert_ready"
      : build.ok && score.total >= 80
        ? "usable"
        : build.ok
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
    id: job.id,
    prompt: job.prompt,
    status: job.status,
    phase: job.phase,
    target: job.target,
    targetLabel: targetProfile.label,
    readiness,
    score,
    build,
    attempts: {
      current: job.attempts,
      max: job.max_attempts
    },
    files: {
      count: files.length,
      paths,
      generatedAssets
    },
    capabilities: {
      webApp: true,
      androidReady: isAndroid,
      gameReady: isGame,
      persistentJob: true,
      cronResume: true,
      svgAssets: generatedAssets.length > 0,
      realServerBuild: false,
      apkBuildOnWorker: false
    },
    deployment: {
      cloudflarePages: {
        buildCommand: "npm run build",
        outputDirectory: "dist",
        rootDirectory: "/"
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
              "npx cap open android"
            ]
          }
        : {
            supported: false
          }
    },
    nextActions: [],
    summary: [
      `Project target: ${job.target}.`,
      `Readiness: ${readiness}.`,
      `Score: ${score.total}/100.`,
      `Virtual build: ${build.ok ? "PASS" : "ISSUES"}.`,
      isAndroid
        ? "Android packaging: Capacitor-ready. APK/AAB must be built outside Cloudflare Worker."
        : ""
    ]
      .filter(Boolean)
      .join(" ")
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      ...corsHeaders(),
      "Content-Type": "application/json"
    }
  });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization"
  };
  }
