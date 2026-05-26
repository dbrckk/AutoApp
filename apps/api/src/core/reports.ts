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

  const readiness =
    build.ok && score.total >= 90
      ? "expert_ready"
      : build.ok && score.total >= 80
        ? "usable"
        : build.ok
          ? "needs_polish"
          : "needs_repair";

  const missingRecommendedFiles = (
    targetProfile.recommendedFiles || []
  ).filter((path) => !paths.includes(path));

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
}: {
  job: PersistentJob;
  score: any;
  build: any;
  readiness: string;
  isAndroid: boolean;
  isGame: boolean;
  generatedAssets: string[];
}) {
  const lines: string[] = [];

  lines.push(`Project target: ${job.target}.`);
  lines.push(`Readiness: ${readiness}.`);
  lines.push(`Score: ${score.total}/100.`);
  lines.push(`Virtual build: ${build.ok ? "PASS" : "ISSUES"}.`);

  if (isGame) {
    lines.push(
      `Game assets generated: ${generatedAssets.length > 0 ? "yes" : "no"}.`
    );
  }

  if (isAndroid) {
    lines.push(
      "Android packaging: Capacitor-ready. APK/AAB must be built outside Cloudflare Worker."
    );
  }

  if (!build.ok) {
    lines.push("Priority: repair build/import/dependency issues.");
  } else if (score.total < 90) {
    lines.push(
      "Priority: continue autonomous improvement until score reaches 90+."
    );
  } else {
    lines.push("Project is ready for export, deployment and final testing.");
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
