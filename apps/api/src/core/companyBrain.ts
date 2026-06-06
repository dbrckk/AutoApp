import type { VirtualFile } from "./types";

import { runQualityGate } from "./qualityGate";
import { createInitialProductMemory, productMemoryToPrompt, updateProductMemory, type ProductMemory } from "./productMemory";
import { makeProductDecision, decisionToPrompt } from "./decisionEngine";
import { createBacklog, createMission, missionToPrompt } from "./missionEngine";
import { calculateKpis, kpisToPrompt } from "./kpiEngine";

export type CompanyBrainSnapshot = {
  memory: ProductMemory;
  quality: ReturnType<typeof runQualityGate>;
  mission: ReturnType<typeof createMission>;
  backlog: ReturnType<typeof createBacklog>;
  kpis: ReturnType<typeof calculateKpis>;
  promptContext: string;
};

export function createCompanyBrain(input: {
  prompt: string;
  files: VirtualFile[];
  previousMemory?: ProductMemory | null;
  buildOk?: boolean;
}): CompanyBrainSnapshot {
  const quality = runQualityGate(input.files);

  const memory = updateProductMemory({
    memory:
      input.previousMemory ||
      createInitialProductMemory({
        prompt: input.prompt,
        files: input.files,
      }),
    prompt: input.prompt,
    files: input.files,
  });

  const mission = createMission({
    memory,
    quality,
  });

  const decision = makeProductDecision({
    memory,
    quality,
    target: mission.category,
  });

  const updatedMemory = updateProductMemory({
    memory,
    prompt: input.prompt,
    files: input.files,
    decision,
  });

  const backlog = createBacklog({
    memory: updatedMemory,
    quality,
  });

  const content = input.files.map((file) => file.content || "").join("\n");

  const kpis = calculateKpis({
    quality,
    buildOk: Boolean(input.buildOk),
    hasGitHub: /github|repo|commit/i.test(content),
    hasTests: /describe\(|it\(|test\(/i.test(content),
    hasPersistence: /localStorage|indexedDB/i.test(content),
  });

  const promptContext = [
    productMemoryToPrompt(updatedMemory),
    "",
    missionToPrompt(mission),
    "",
    decisionToPrompt(decision),
    "",
    kpisToPrompt(kpis),
  ].join("\n");

  return {
    memory: updatedMemory,
    quality,
    mission,
    backlog,
    kpis,
    promptContext,
  };
    }
    
