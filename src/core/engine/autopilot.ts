import type { AiCaller, BuildMode, GenerateInput, GenerateOutput, VirtualFile } from "./types";
import { orchestrateGeneration } from "./orchestration";

export type AutopilotInput = {
  projectId?: string;
  prompt: string;
  files: VirtualFile[];
  callAi: AiCaller;
  buildMode?: BuildMode;
  targetScore?: number;
  maxIterations?: number;
  onLog?: (message: string) => void;
};

export type AutopilotOutput = {
  files: VirtualFile[];
  iterations: GenerateOutput[];
  finalScore: number;
  reachedTarget: boolean;
  logs: string[];
};

export async function runAutopilot(input: AutopilotInput): Promise<AutopilotOutput> {
  const targetScore = input.targetScore ?? 90;
  const maxIterations = input.maxIterations ?? 5;
  const logs: string[] = [];
  const iterations: GenerateOutput[] = [];

  let currentFiles = input.files;

  function log(message: string) {
    const entry = `${new Date().toISOString()} · ${message}`;
    logs.push(entry);
    input.onLog?.(entry);
  }

  log(`Autopilot started. Target score: ${targetScore}. Max iterations: ${maxIterations}.`);

  for (let index = 1; index <= maxIterations; index++) {
    const previousScore = iterations.at(-1)?.score?.total ?? 0;

    if (previousScore >= targetScore) {
      log(`Target reached before iteration ${index}. Score: ${previousScore}.`);
      break;
    }

    log(`Iteration ${index}/${maxIterations} started.`);

    const generationInput: GenerateInput = {
      projectId: input.projectId,
      prompt: buildAutopilotPrompt({
        userPrompt: input.prompt,
        iteration: index,
        targetScore,
        previousScore,
        previousOutput: iterations.at(-1),
      }),
      currentFiles,
      isAutoImprove: true,
      buildMode: input.buildMode || "virtual",
    };

    const result = await orchestrateGeneration(generationInput, input.callAi);

    iterations.push(result);
    currentFiles = mergeAutopilotFiles(currentFiles, result.files);

    log(`Iteration ${index} completed. Score: ${result.score.total}. Mode: ${result.mode}.`);

    if (result.score.total >= targetScore) {
      log(`Target reached. Final score: ${result.score.total}.`);
      break;
    }

    if (index > 1) {
      const before = iterations[index - 2]?.score?.total ?? 0;
      const after = result.score.total;

      if (after <= before) {
        log(`Score did not improve: ${before} → ${after}. Next iteration will focus on reliability and buildability.`);
      }
    }
  }

  const finalScore = iterations.at(-1)?.score?.total ?? 0;

  return {
    files: currentFiles,
    iterations,
    finalScore,
    reachedTarget: finalScore >= targetScore,
    logs,
  };
}

function buildAutopilotPrompt(params: {
  userPrompt: string;
  iteration: number;
  targetScore: number;
  previousScore: number;
  previousOutput?: GenerateOutput;
}) {
  const previousActions = params.previousOutput?.nextActions?.length
    ? params.previousOutput.nextActions.map((action, i) => `${i + 1}. ${action}`).join("\n")
    : "No previous actions available.";

  return [
    "Autopilot improvement iteration.",
    "",
    `Original user goal: ${params.userPrompt}`,
    `Iteration: ${params.iteration}`,
    `Target score: ${params.targetScore}`,
    `Previous score: ${params.previousScore}`,
    "",
    "Previous next actions:",
    previousActions,
    "",
    "Objective:",
    "- Improve the lowest-scoring areas first.",
    "- Preserve working features.",
    "- Keep the project buildable.",
    "- Prefer small reliable upgrades over risky rewrites.",
    "- Return complete changed files only.",
    "",
    "Priority order:",
    "1. Build reliability",
    "2. Broken imports and dependencies",
    "3. Architecture",
    "4. Mobile UX",
    "5. Error/loading/empty states",
    "6. Accessibility",
    "7. SEO",
    "8. Visual polish",
    "9. Monetization",
  ].join("\n");
}

function mergeAutopilotFiles(currentFiles: VirtualFile[], changedFiles: VirtualFile[]) {
  const map = new Map<string, VirtualFile>();

  for (const file of currentFiles) {
    map.set(normalizePath(file.path), {
      ...file,
      path: normalizePath(file.path),
    });
  }

  for (const file of changedFiles) {
    const path = normalizePath(file.path);

    if (file.content === null) {
      map.delete(path);
      continue;
    }

    map.set(path, {
      path,
      content: file.content,
    });
  }

  return Array.from(map.values()).sort((a, b) => a.path.localeCompare(b.path));
}

function normalizePath(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
      }
