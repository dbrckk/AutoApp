import type { PersistentJob, VirtualFile } from "./types";

import { normalizePath } from "./files";
import { inspectProject } from "./inspect";
import { buildNextActions, scoreProject } from "./scoring";
import { getTargetProfile } from "./targets";

export function createAutonomousReport({
  job,
  files,
  build,
  score,
  targetProfile,
}: {
  job: PersistentJob;
  files: VirtualFile[];
  build: any;
  score: any;
  targetProfile: ReturnType<typeof getTargetProfile>;
}) {
  const paths = files.map((file) => normalizePath(file.path));
  const isAndroid = String(job.target || "").includes("android");
  const isGame = String(job.target || "").includes("game");

  const githubRepo = getRepoFromPrompt(job.prompt);
  const githubBranch = getBranchFromPrompt(job.prompt);

  const readiness =
    build.ok && score.total >= 90
      ? "expert_ready"
      : build.ok && score.total >= 80
        ? "usable"
        : build.ok
          ? "needs_polish"
          : "needs_repair";

  const missingRecommendedFiles = (targetProfile.recommendedFiles || []).filter(
    (path) => !paths.includes(path)
  );

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
      max: job.max_attempts,
    },
    files: {
      count: files.length,
      paths,
      generatedAssets,
      missingRecommendedFiles,
    },
    capabilities: {
      generation: "real_ai_call",
      persistentJob: "real_d1_job",
      cronResume: "real_cloudflare_cron",
      memory: "real_d1_memory",
      githubExport: "real_github_commit_if_configured",
      webApp: true,
      androidReady: isAndroid,
      gameReady: isGame,
      svgAssets: generatedAssets.length > 0,
      virtualBuildCheck: "static_analysis_only",
      dependencyResolution: "static_package_json_resolution",
      realServerBuild: "not_configured",
      apkBuildOnWorker: "not_supported_on_cloudflare_worker",
      preview: "not_configured",
    },
    deployment: {
      cloudflarePages: {
        supported: true,
        realBuildProvider: true,
        buildCommand: "npm run build",
        outputDirectory: "dist",
        rootDirectory: "/",
      },
      github: {
        supported: true,
        realCommit: true,
        configuredForThisJob: Boolean(githubRepo),
        repo: githubRepo || null,
        branch: githubBranch,
        requires: "GITHUB_TOKEN",
      },
      android: isAndroid
        ? {
            supported: true,
            method: "Capacitor",
            guideFile: "/ANDROID_BUILD.md",
            workerCanBuildApk: false,
            commands: [
              "npm install",
              "npm run build",
              "npm install @capacitor/core @capacitor/cli @capacitor/android",
              "npx cap add android",
              "npx cap sync android",
              "npx cap open android",
            ],
          }
        : {
            supported: false,
          },
    },
    nextActions: buildNextActions(score, build),
    summary: createReportSummary({
      job,
      score,
      build,
      readiness,
      isAndroid,
      isGame,
      generatedAssets,
      githubRepo,
      githubBranch,
    }),
  };
}

export function createReportSummary({
  job,
  score,
  build,
  readiness,
  isAndroid,
  isGame,
  generatedAssets,
  githubRepo,
  githubBranch,
}: {
  job: PersistentJob;
  score: any;
  build: any;
  readiness: string;
  isAndroid: boolean;
  isGame: boolean;
  generatedAssets: string[];
  githubRepo?: string;
  githubBranch?: string;
}) {
  const lines: string[] = [];

  lines.push(`Project target: ${job.target}.`);
  lines.push(`Readiness: ${readiness}.`);
  lines.push(`Score: ${score.total}/100.`);
  lines.push(
    `Virtual build check: ${
      build.ok ? "PASS" : "ISSUES"
    }; this is static analysis, not a real npm build.`
  );

  if (githubRepo) {
    lines.push(
      `GitHub export target: ${githubRepo} on branch ${
        githubBranch || "main"
      }.`
    );
  } else {
    lines.push("GitHub export target: not configured for this job.");
  }

  if (isGame) {
    lines.push(
      `Game assets generated: ${generatedAssets.length > 0 ? "yes" : "no"}.`
    );
  }

  if (isAndroid) {
    lines.push(
      "Android packaging is Capacitor-ready, but APK/AAB build must happen outside Cloudflare Worker."
    );
  }

  if (!build.ok) {
    lines.push("Priority: repair build/import/dependency issues.");
  } else if (score.total < 90) {
    lines.push(
      "Priority: continue autonomous improvement until score reaches 90+."
    );
  } else {
    lines.push("Project is ready for GitHub export and real deployment build.");
  }

  return lines.join(" ");
}

export function createPublishReport(files: VirtualFile[]) {
  const inspection = inspectProject(files);
  const score = scoreProject(files);
  const blockers = [...inspection.missingCriticalFiles];

  return {
    ready: blockers.length === 0 && score.total >= 75,
    score: Math.max(0, score.total - blockers.length * 10),
    qualityScore: score.total,
    blockers,
    warnings: inspection.risks,
    realStatus: {
      staticInspection: true,
      realNpmBuild: false,
      realPreview: false,
      realGitHubExportAvailable: true,
      realDeploymentBuildRequires: "GitHub + Cloudflare Pages or Vercel",
    },
    checklist: [
      "Run dependency resolver.",
      "Run static build check.",
      "Export files to GitHub.",
      "Let Cloudflare Pages or Vercel run the real build.",
      "Open the deployed URL.",
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

function getRepoFromPrompt(prompt: string) {
  const match = String(prompt).match(
    /github\s*repo\s*:\s*([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+)/i
  );

  return match?.[1] || "";
}

function getBranchFromPrompt(prompt: string) {
  const match = String(prompt).match(
    /github\s*branch\s*:\s*([a-zA-Z0-9_.\/-]+)/i
  );

  return match?.[1] || "main";
      }
