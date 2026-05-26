import type { AiConfig, Env, VirtualFile } from "./types";

import {
  cleanFiles,
  diffFiles,
  mergeFiles,
  normalizeGeneratedFiles,
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

  const changelog: string[] = [];

  const target = detectTarget(prompt);
  const buildBefore = virtualBuildCheck(currentFiles);
  const scoreBefore = scoreProject(currentFiles);

  const output = await callAiJson(
    env,
    aiConfig,
    buildExpertPrompt({
      userPrompt: createGenerationIntent({
        prompt,
        isAutoImprove: Boolean(isAutoImprove),
        buildMode: buildMode || "virtual",
      }),
      files: currentFiles,
      build: buildBefore,
      score: scoreBefore,
      target,
    })
  );

  const generatedFiles = normalizeGeneratedFiles(output?.files || []);

  currentFiles = mergeFiles(currentFiles, generatedFiles);

  currentFiles = applyDependencyResolution(
    currentFiles,
    resolveDependencies(currentFiles).packageJson
  );

  let build = virtualBuildCheck(currentFiles);
  let score = scoreProject(currentFiles);

  changelog.push(String(output?.changelog || "Generated project files."));

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

    const repairFiles = normalizeGeneratedFiles(repair?.files || []);

    currentFiles = mergeFiles(currentFiles, repairFiles);

    currentFiles = applyDependencyResolution(
      currentFiles,
      resolveDependencies(currentFiles).packageJson
    );

    changelog.push(String(repair?.changelog || "Repair pass applied."));

    build = virtualBuildCheck(currentFiles);
    score = scoreProject(currentFiles);
  }

  return {
    files: diffFiles(originalFiles, currentFiles),
    changelog: changelog.join("\n"),
    estimatedTimeSaved: String(
      output?.estimatedTimeSaved || "Several hours saved."
    ),
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
    "Build mode:",
    buildMode,
    "",
    "User request:",
    prompt,
  ].join("\n");
}
