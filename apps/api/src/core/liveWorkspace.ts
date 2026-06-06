import type { VirtualFile } from "./types";
import { createCompanyBrain } from "./companyBrain";
import { createDiffSummary } from "./diffEngine";
import { createRefactorPlan } from "./refactorPlanner";
import { runQualityGate } from "./qualityGate";

export type LiveWorkspaceSnapshot = {
  selectedPath?: string;
  selectedFilePath?: string;
  neighborPaths: string[];
  importantPaths: string[];
  brain: ReturnType<typeof createCompanyBrain>;
  refactorPlan: ReturnType<typeof createRefactorPlan>;
  quality: ReturnType<typeof runQualityGate>;
  diff?: ReturnType<typeof createDiffSummary>;
};

export function createLiveWorkspaceSnapshot(input: {
  prompt: string;
  files: VirtualFile[];
  previousFiles?: VirtualFile[];
  selectedPath?: string;
  buildOk?: boolean;
}): LiveWorkspaceSnapshot {
  const selectedFile =
    input.files.find((file) => file.path === input.selectedPath) ||
    input.files.find((file) => file.path === "/src/App.tsx") ||
    input.files[0] ||
    null;

  const brain = createCompanyBrain({
    prompt: input.prompt,
    files: input.files,
    buildOk: Boolean(input.buildOk),
  });

  const quality = runQualityGate(input.files);

  const refactorPlan = createRefactorPlan({
    files: input.files,
    selectedPath: selectedFile?.path,
    missionCategory: brain.mission.category,
  });

  return {
    selectedPath: input.selectedPath,
    selectedFilePath: selectedFile?.path,
    neighborPaths: findNeighborPaths(input.files, selectedFile?.path || ""),
    importantPaths: findImportantPaths(input.files),
    brain,
    refactorPlan,
    quality,
    diff: input.previousFiles ? createDiffSummary(input.previousFiles, input.files) : undefined,
  };
}

function findNeighborPaths(files: VirtualFile[], selectedPath: string) {
  if (!selectedPath) return [];
  const folder = selectedPath.split("/").slice(0, -1).join("/");
  return files
    .filter((file) => file.path !== selectedPath && file.path.startsWith(folder))
    .slice(0, 8)
    .map((file) => file.path);
}

function findImportantPaths(files: VirtualFile[]) {
  const priority = ["/package.json", "/index.html", "/src/main.tsx", "/src/App.tsx", "/src/index.css"];
  const result: string[] = [];

  for (const path of priority) {
    if (files.some((file) => file.path === path)) result.push(path);
  }

  for (const file of files) {
    if (result.length >= 12) break;
    if (!result.includes(file.path) && file.path.includes("/components/")) result.push(file.path);
  }

  return result;
  }
  
