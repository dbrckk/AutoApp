import type { AiConfig, Env, VirtualFile } from "../core/types";

import { callAiJson } from "../core/ai";

import {

applyDependencyResolution,

resolveDependencies,

virtualBuildCheck,

} from "../core/build";

import {

cleanFiles,

mergeFiles,

normalizeGeneratedFiles,

serializeFiles,

} from "../core/files";

import { scoreProject } from "../core/scoring";

import { getTargetProfile } from "../core/targets";

import { getAgent, type AgentRole } from "./registry";

export type AgentContext = {

userPrompt: string;

target: string;

files: VirtualFile[];

build: any;

score: any;

phase?: string;

strategy?: string;

};

export type AgentOutput = {

files: VirtualFile[];

changelog: string;

estimatedTimeSaved: string;

notes: string[];

};

export async function runAgent({

env,

aiConfig,

role,

context,

}: {

env: Env;

aiConfig?: AiConfig;

role: AgentRole;

context: AgentContext;

}): Promise<AgentOutput> {

const agent = getAgent(role);

const output = await callAiJson(

env,

aiConfig,

buildAgentPrompt({

role,

context,

})

);

return {

files: normalizeGeneratedFiles(output?.files || []),

changelog: String(output?.changelog || `${agent.name} completed.`),

estimatedTimeSaved: String(

output?.estimatedTimeSaved || "Several hours saved."

),

notes: Array.isArray(output?.notes) ? output.notes.map(String) : [],

};

}

export async function runAgentPipeline({

env,

aiConfig,

userPrompt,

files,

target,

roles,

phase,

}: {

env: Env;

aiConfig?: AiConfig;

userPrompt: string;

files: VirtualFile[];

target: string;

roles: AgentRole[];

phase?: string;

}) {

let currentFiles = cleanFiles(files || []);

const safeRoles = limitAgentRoles({

roles,

target,

phase,

});

const iterations: {

role: AgentRole;

changelog: string;

score: any;

build: any;

}[] = [];

for (const role of safeRoles) {

const buildBefore = virtualBuildCheck(currentFiles);

const scoreBefore = scoreProject(currentFiles);

const result = await runAgent({

env,

aiConfig,

role,

context: {

userPrompt,

target,

files: currentFiles,

build: buildBefore,

score: scoreBefore,

phase,

strategy: undefined,

},

});

currentFiles = mergeFiles(currentFiles, result.files);

currentFiles = applyDependencyResolution(

currentFiles,

resolveDependencies(currentFiles).packageJson

);

const buildAfter = virtualBuildCheck(currentFiles);

const scoreAfter = scoreProject(currentFiles);

iterations.push({

role,

changelog: result.changelog,

score: scoreAfter,

build: buildAfter,

});

if (!buildAfter.ok && role !== "repair") {

const repairResult = await runAgent({

env,

aiConfig,

role: "repair",

context: {

userPrompt,

target,

files: currentFiles,

build: buildAfter,

score: scoreAfter,

phase: "repair",

strategy: "auto_repair_after_agent",

},

});

currentFiles = mergeFiles(currentFiles, repairResult.files);

currentFiles = applyDependencyResolution(

currentFiles,

resolveDependencies(currentFiles).packageJson

);

iterations.push({

role: "repair",

changelog: repairResult.changelog,

score: scoreProject(currentFiles),

build: virtualBuildCheck(currentFiles),

});

}

}

return {

files: currentFiles,

iterations,

score: scoreProject(currentFiles),

build: virtualBuildCheck(currentFiles),

};

}

export function selectAgentRoles({

target,

build,

score,

phase,

strategy,

}: {

target: string;

build: any;

score: any;

phase?: string;

strategy?: string;

}): AgentRole[] {

const normalizedTarget = String(target || "").toLowerCase();

const normalizedPhase = String(phase || "");

const normalizedStrategy = String(strategy || "normal");

if (!build.ok) return ["repair", "reviewer"];

if (normalizedStrategy === "repair") return ["repair", "reviewer"];

if (normalizedStrategy === "force_product_depth") {

return normalizedTarget.includes("game")

? ["gameplay", "retention", "reviewer"]

: ["planner", "frontend", "reviewer"];

}

if (normalizedStrategy === "force_ui") return ["designer", "frontend", "mobile"];

if (normalizedStrategy === "force_mobile") return ["mobile", "frontend", "optimizer"];

if (normalizedStrategy === "force_reliability") return ["repair", "optimizer", "reviewer"];

if (normalizedStrategy === "force_assets") {

return normalizedTarget.includes("game")

? ["designer", "gameplay", "frontend"]

: ["designer", "frontend"];

}

if (normalizedStrategy === "force_feedback") {

return normalizedTarget.includes("game")

? ["gameplay", "designer", "mobile"]

: ["designer", "frontend", "mobile"];

}

if (normalizedStrategy === "finalize") return ["packager", "reviewer"];

if (normalizedPhase === "product_spec") return ["planner"];

if (normalizedPhase === "architecture") return ["architect", "reviewer"];

if (normalizedPhase === "core_features") {

return normalizedTarget.includes("game")

? ["gameplay", "frontend", "reviewer"]

: ["frontend", "backend", "reviewer"];

}

if (normalizedPhase === "gameplay_or_business_logic") {

return normalizedTarget.includes("game")

? ["gameplay", "retention", "optimizer"]

: ["backend", "frontend", "reviewer"];

}

if (normalizedPhase === "retention_systems") return ["retention", "gameplay", "designer"];

if (normalizedPhase === "monetization_systems") return ["monetization", "security", "reviewer"];

if (normalizedPhase === "ui_system") return ["designer", "frontend", "mobile"];

if (normalizedPhase === "sprites_and_assets") return ["designer", "gameplay", "frontend"];

if (normalizedPhase === "animations_and_feedback") {

return normalizedTarget.includes("game")

? ["gameplay", "designer", "optimizer"]

: ["designer", "frontend", "optimizer"];

}

if (normalizedPhase === "repair") return ["repair", "reviewer"];

if (normalizedPhase === "final_packaging") return ["packager", "security", "reviewer"];

if (normalizedPhase === "final_audit") return ["reviewer", "repair", "security"];

if (normalizedTarget.includes("game")) {

if (score.productDepth < 80) return ["gameplay", "retention", "reviewer"];

if (score.mobile < 85) return ["mobile", "designer", "optimizer"];

if (score.ui < 85) return ["designer", "frontend", "mobile"];

if (score.reliability < 85) return ["repair", "optimizer", "reviewer"];

return ["gameplay", "retention", "designer"];

}

if (score.productDepth < 70) return ["planner", "frontend", "reviewer"];

if (score.ui < 75) return ["designer", "frontend", "mobile"];

if (score.mobile < 75) return ["mobile", "frontend"];

if (score.reliability < 75) return ["repair", "optimizer", "reviewer"];

return ["frontend", "reviewer"];

}

export function limitAgentRoles({

roles,

target,

phase,

}: {

roles: AgentRole[];

target: string;

phase?: string;

}): AgentRole[] {

const unique = Array.from(new Set(roles));

if (phase === "product_spec") return unique.slice(0, 1);

if (phase === "architecture") return unique.slice(0, 2);

if (phase === "repair") return unique.slice(0, 2);

if (phase === "final_packaging") return unique.slice(0, 3);

if (phase === "final_audit") return unique.slice(0, 3);

if (String(target || "").includes("game")) return unique.slice(0, 3);

if (String(target || "").includes("android")) return unique.slice(0, 3);

return unique.slice(0, 3);

}

function buildAgentPrompt({

role,

context,

}: {

role: AgentRole;

context: AgentContext;

}) {

const agent = getAgent(role);

const targetProfile = getTargetProfile(context.target);

return [

agent.systemPrompt,

"",

"Return ONLY valid JSON.",

"No markdown.",

"No code fences.",

"",

"Required JSON shape:",

JSON.stringify(

{

files: [

{

path: "/src/App.tsx",

content: "complete file content",

},

],

changelog: "clear summary",

estimatedTimeSaved: "estimate",

notes: ["optional concise note"],

},

null,

2

),

"",

"Agent role:",

agent.role,

"",

"Agent name:",

agent.name,

"",

"Agent mission:",

agent.mission,

"",

"Global user request:",

context.userPrompt,

"",

"Target:",

context.target,

"",

"Target profile:",

JSON.stringify(targetProfile, null, 2),

"",

"Current phase:",

context.phase || "none",

"",

"Current strategy:",

context.strategy || "normal",

"",

"Current build:",

JSON.stringify(context.build, null, 2),

"",

"Current score:",

JSON.stringify(context.score, null, 2),

"",

"Rules:",

"- Return complete changed files only.",

"- Keep npm install && npm run build valid.",

"- Do not remove useful features.",

"- Avoid placeholder UI.",

"- Avoid fake APIs unless clearly implemented as safe integration hooks.",

"- Prefer local assets.",

"- Use TypeScript-compatible React.",

"- Add real product depth.",

"- For games, add actual gameplay systems.",

"- For mobile, fix touch and viewport details.",

"- Preserve existing project identity and progressively improve it.",

"",

"Current files:",

serializeFiles(context.files),

].join("\n");

  }
