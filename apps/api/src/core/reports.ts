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

const infinite = /auto\s*improve\s*forever\s*:\s*true/i.test(job.prompt);

const readiness = calculateReadiness({ build, score });

const focus = calculateNextFocus({ build, score, isGame, isAndroid });

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

focus,

score,

build,

attempts: {

current: job.attempts,

max: job.max_attempts,

infinite,

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

focus,

isAndroid,

isGame,

generatedAssets,

githubRepo,

githubBranch,

infinite,

}),

};

}

export function createReportSummary({

job,

score,

build,

readiness,

focus,

isAndroid,

isGame,

generatedAssets,

githubRepo,

githubBranch,

infinite,

}: {

job: PersistentJob;

score: any;

build: any;

readiness: string;

focus: string;

isAndroid: boolean;

isGame: boolean;

generatedAssets: string[];

githubRepo?: string;

githubBranch?: string;

infinite?: boolean;

}) {

const lines: string[] = [];

lines.push(`Project target: ${job.target}.`);

lines.push(`Readiness: ${readiness}.`);

lines.push(`Score: ${score.total}/100.`);

lines.push(`Recommended next focus: ${focus}.`);

lines.push(

`Virtual build check: ${build.ok ? "PASS" : "ISSUES"}; this is static analysis, not a real npm build.`

);

if (infinite) lines.push("Infinite improvement is enabled; cron can continue after the browser is closed.");

if (githubRepo) lines.push(`GitHub export target: ${githubRepo} on branch ${githubBranch || "main"}.`);

else lines.push("GitHub export target: not configured for this job.");

if (isGame) {

lines.push(`Game systems score: ${score.gameplay || 0}/100; retention score: ${score.retention || 0}/100.`);

lines.push(`Game assets generated: ${generatedAssets.length > 0 ? "yes" : "no"}.`);

}

if (isAndroid) lines.push(`Android readiness score: ${score.androidReady || 0}/100. APK/AAB build must happen outside Cloudflare Worker.`);

if (!build.ok) lines.push("Priority: repair build/import/dependency issues.");

else if (score.total < 90) lines.push("Priority: continue autonomous improvement until score reaches 90+.");

else lines.push("Project is ready for GitHub export and real deployment build.");

return lines.join(" ");

}

export function createPublishReport(files: VirtualFile[]) {

const inspection = inspectProject(files);

const score = scoreProject(files);

const blockers = [...inspection.missingCriticalFiles];

const buildRisks = inspection.risks || [];

return {

ready: blockers.length === 0 && score.total >= 75,

score: Math.max(0, score.total - blockers.length * 10),

qualityScore: score.total,

scoreBreakdown: score,

blockers,

warnings: buildRisks,

nextFocus: calculateNextFocus({

build: { ok: blockers.length === 0 },

score,

isGame: score.gameplay > 0,

isAndroid: score.androidReady > 0,

}),

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

"If Android target: build APK/AAB using Android Studio or a real CI build environment.",

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

function calculateReadiness({ build, score }: { build: any; score: any }) {

if (!build.ok) return "needs_repair";

if (score.total >= 92 && score.reliability >= 85) return "release_candidate";

if (score.total >= 85) return "strong_alpha";

if (score.total >= 75) return "usable_alpha";

if (score.total >= 60) return "prototype";

return "early_draft";

}

function calculateNextFocus({ build, score, isGame, isAndroid }: { build: any; score: any; isGame: boolean; isAndroid: boolean }) {

if (!build.ok) return "repair_build";

if ((score.antiPlaceholder || 0) < 80) return "replace_placeholders";

if ((score.reliability || 0) < 80) return "reliability";

if (isGame && (score.gameplay || 0) < 80) return "gameplay_depth";

if (isGame && (score.retention || 0) < 75) return "retention_systems";

if (isGame && (score.monetization || 0) < 60) return "monetization_hooks";

if ((score.mobile || 0) < 85) return "mobile_ux";

if ((score.ui || 0) < 85) return "ui_polish";

if (isAndroid && (score.androidReady || 0) < 80) return "android_packaging";

if ((score.productionReadiness || 0) < 85) return "production_readiness";

return "final_polish";

}

function getRepoFromPrompt(prompt: string) {

const match = String(prompt).match(/github\s*repo\s*:\s*([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+)/i);

return match?.[1] || "";

}

function getBranchFromPrompt(prompt: string) {

const match = String(prompt).match(/github\s*branch\s*:\s*([a-zA-Z0-9_.\/-]+)/i);

return match?.[1] || "main";

  }
