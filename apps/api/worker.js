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
