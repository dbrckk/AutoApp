import type { AiConfig, Env, VirtualFile } from "../core/types";
import type { AgentContext, AgentOutput, AgentRole } from "./types";

import { callAiJson } from "../core/ai";
import { cleanFiles, mergeFiles, normalizeGeneratedFiles, serializeFiles } from "../core/files";
import { applyDependencyResolution, resolveDependencies, virtualBuildCheck } from "../core/build";
import { scoreProject } from "../core/scoring";
import { getTargetProfile } from "../core/targets";
import { getAgent } from "./registry";

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
    estimatedTimeSaved: String(output?.estimatedTimeSaved || "Several hours saved."),
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
}: {
  env: Env;
  aiConfig?: AiConfig;
  userPrompt: string;
  files: VirtualFile[];
  target: string;
  roles: AgentRole[];
}) {
  let currentFiles = cleanFiles(files || []);
  const iterations: {
    role: AgentRole;
    changelog: string;
    score: any;
    build: any;
  }[] = [];

  for (const role of roles) {
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
  if (!build.ok) {
    return ["repair", "reviewer"];
  }

  if (phase === "product_spec") return ["planner"];
  if (phase === "architecture") return ["architect"];
  if (phase === "ui_system") return ["frontend", "mobile"];
  if (phase === "core_features") return ["frontend", "reviewer"];

  if (phase === "gameplay_or_business_logic") {
    return target.includes("game")
      ? ["gameplay", "frontend", "reviewer"]
      : ["frontend", "reviewer"];
  }

  if (phase === "sprites_and_assets") {
    return target.includes("game")
      ? ["gameplay", "frontend"]
      : ["frontend"];
  }

  if (phase === "animations_and_feedback") {
    return target.includes("game")
      ? ["gameplay", "mobile", "reviewer"]
      : ["frontend", "mobile", "reviewer"];
  }

  if (phase === "repair") return ["repair", "reviewer"];
  if (phase === "launch_pack") return ["packager"];
  if (phase === "final_packaging") return ["packager", "reviewer"];
  if (phase === "final_audit") return ["reviewer", "repair"];

  if (strategy === "force_product_depth") return ["planner", "frontend", "reviewer"];
  if (strategy === "force_ui") return ["frontend", "mobile", "reviewer"];
  if (strategy === "force_mobile") return ["mobile", "frontend"];
  if (strategy === "force_reliability") return ["repair", "reviewer"];
  if (strategy === "force_assets") return target.includes("game") ? ["gameplay"] : ["frontend"];
  if (strategy === "force_feedback") {
    return target.includes("game") ? ["gameplay", "mobile"] : ["frontend", "mobile"];
  }
  if (strategy === "finalize") return ["packager", "reviewer"];

  if (target.includes("game")) return ["planner", "gameplay", "frontend", "mobile", "reviewer"];
  if (target.includes("android")) return ["planner", "frontend", "mobile", "packager"];

  if (score.productDepth < 70) return ["planner", "frontend", "reviewer"];
  if (score.ui < 75) return ["frontend", "mobile"];
  if (score.reliability < 75) return ["repair", "reviewer"];

  return ["frontend", "reviewer"];
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
    "Return ONLY valid JSON. No markdown. No code fences.",
    "",
    "Required JSON shape:",
    JSON.stringify(
      {
        files: [{ path: "/src/App.tsx", content: "complete file content" }],
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
    "- Do not create empty placeholder UI.",
    "- Prefer local assets over external URLs.",
    "- For React, use TypeScript-compatible code.",
    "- For games, implement real stateful gameplay.",
    "- For Android, include mobile-first and Capacitor-ready details when relevant.",
    "",
    "Current files:",
    serializeFiles(context.files),
  ].join("\n");
    }
