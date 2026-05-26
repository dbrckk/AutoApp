import type { AiConfig, Env, VirtualFile } from "./types";

import {
  cleanFiles,
  diffFiles,
} from "./files";

import {
  applyDependencyResolution,
  resolveDependencies,
  virtualBuildCheck,
} from "./build";

import { callAiJson } from "./ai";

import {
  buildExpertPrompt,
  buildRepairPrompt,
} from "./prompts";

import { detectTarget } from "./targets";

import {
  buildNextActions,
  scoreProject,
} from "./scoring";

import {
  runAgentPipeline,
  selectAgentRoles,
} from "../agents/runner";

export async function generateProject({
  env,
  prompt,
  files,
  aiConfig,
  buildMode,
  isAutoImprove,
}: {
  env: Env;
  prompt: string;
  files: VirtualFile[];
  aiConfig?: AiConfig;
  buildMode?: "none" | "virtual" | "real";
  isAutoImprove?: boolean;
}) {
  const originalFiles = cleanFiles(files || []);
  let currentFiles = originalFiles;

  const target = detectTarget(prompt);
  const buildBefore = virtualBuildCheck(currentFiles);
  const scoreBefore = scoreProject(currentFiles);

  const roles = selectAgentRoles({
    target,
    build: buildBefore,
    score: scoreBefore,
    strategy: isAutoImprove ? "force_product_depth" : "normal",
  });

  const pipeline = await runAgentPipeline({
    env,
    aiConfig,
    userPrompt: createGenerationIntent({
      prompt,
      isAutoImprove: Boolean(isAutoImprove),
      buildMode: buildMode || "virtual",
    }),
    files: currentFiles,
    target,
    roles,
  });

  currentFiles = pipeline.files;

  currentFiles = applyDependencyResolution(
    currentFiles,
    resolveDependencies(currentFiles).packageJson
  );

  let build = virtualBuildCheck(currentFiles);
  let score = scoreProject(currentFiles);

  const changelog = pipeline.iterations.map(
    (iteration) =>
      `${iteration.role}: ${iteration.changelog} · score ${iteration.score.total}/100`
  );

  if (!build.ok) {
    const repair = await callAiJson(
      env,
      aiConfig,
      buildRepairPrompt({
        userPrompt: prompt,
        files: currentFiles,
        build,
        score,
      })
    );

    const repairFiles = Array.isArray(repair?.files) ? repair.files : [];

    const repairPipeline = await runAgentPipeline({
      env,
      aiConfig,
      userPrompt: [
        "Repair this project after a failed virtual build.",
        "",
        "Original request:",
        prompt,
        "",
        "Repair model returned these files:",
        JSON.stringify(repairFiles, null, 2),
      ].join("\n"),
      files: currentFiles,
      target,
      roles: ["repair", "reviewer"],
    });

    currentFiles = repairPipeline.files;

    currentFiles = applyDependencyResolution(
      currentFiles,
      resolveDependencies(currentFiles).packageJson
    );

    build = virtualBuildCheck(currentFiles);
    score = scoreProject(currentFiles);

    changelog.push(
      String(repair?.changelog || "Repair pass applied."),
      ...repairPipeline.iterations.map(
        (iteration) =>
          `${iteration.role}: ${iteration.changelog} · score ${iteration.score.total}/100`
      )
    );
  }

  return {
    files: diffFiles(originalFiles, currentFiles),
    changelog: changelog.join("\n"),
    estimatedTimeSaved: "Multi-agent generation pipeline",
    score,
    nextActions: buildNextActions(score, build),
    mode: build.ok ? (originalFiles.length ? "improve" : "create") : "repair",
  };
}

function createGenerationIntent({
  prompt,
  isAutoImprove,
  buildMode,
}: {
  prompt: string;
  isAutoImprove: boolean;
  buildMode: "none" | "virtual" | "real";
}) {
  return [
    isAutoImprove
      ? "Improve the existing project without destroying current features."
      : "Create the requested project from scratch if needed.",
    "",
    "Generation mode:",
    isAutoImprove ? "improve" : "create",
    "",
    "Build mode:",
    buildMode,
    "",
    "Quality target:",
    "The result must be better than a simple AI builder output. Add real product depth, states, workflows, polished UI and deployment readiness.",
    "",
    "User request:",
    prompt,
  ].join("\n");
}
