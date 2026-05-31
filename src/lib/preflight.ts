import type { VirtualFile } from "../types";

export type PreflightResult = {

ok: boolean;

score: number;

blockers: string[];

warnings: string[];

passed: string[];

};

export function runFrontendPreflight(input: {

files: VirtualFile[];

githubRepo: string;

projectReport: any;

diagnostics: any;

}) {

const blockers: string[] = [];

const warnings: string[] = [];

const passed: string[] = [];

const files = input.files || [];

const paths = files.map((file) => file.path);

const report = input.projectReport || {};

const score = report.score || {};

const build = report.build || {};

const diagnostics = input.diagnostics || {};

if (!files.length) blockers.push("No project files loaded.");

else passed.push(`${files.length} files loaded.`);

if (!paths.includes("/package.json")) blockers.push("Missing /package.json.");

else passed.push("package.json present.");

if (!paths.includes("/index.html")) blockers.push("Missing /index.html.");

else passed.push("index.html present.");

if (!paths.includes("/src/main.tsx") && !paths.includes("/src/main.jsx")) {

blockers.push("Missing React entry file.");

} else {

passed.push("React entry file present.");

}

if (!paths.includes("/src/App.tsx") && !paths.includes("/src/App.jsx")) {

blockers.push("Missing App component.");

} else {

passed.push("App component present.");

}

if (build.ok) passed.push("Static build check passes.");

else warnings.push("Static build check not confirmed or has issues.");

if (Number(score.total || 0) >= 75) {

passed.push(`Project score acceptable: ${score.total}/100.`);

} else {

warnings.push(`Project score below target: ${Number(score.total || 0)}/100.`);

}

if (input.githubRepo?.trim()) {

passed.push(`GitHub repo configured: ${input.githubRepo.trim()}.`);

} else {

warnings.push("GitHub repo not configured.");

}

if (report.memory) passed.push("Project memory report loaded.");

else warnings.push("Project memory report not loaded yet.");

const caps =

diagnostics.realCapabilities ||

diagnostics.live?.realCapabilities ||

diagnostics.checks?.realCapabilities ||

{};

if (caps.projectMemory === "real") passed.push("Backend project memory is ready.");

else warnings.push("Backend project memory not confirmed.");

if (caps.githubExport === "real") passed.push("GitHub export is configured.");

else warnings.push("GitHub export not confirmed.");

if (caps.aiGeneration === "real") passed.push("AI generation is configured.");

else warnings.push("AI generation not confirmed by live diagnostics.");

const totalChecks = blockers.length + warnings.length + passed.length;

const scorePercent =

totalChecks === 0

? 0

: Math.round((passed.length / Math.max(1, totalChecks)) * 100);

return {

ok: blockers.length === 0,

score: scorePercent,

blockers,

warnings,

passed,

} satisfies PreflightResult;

    }
