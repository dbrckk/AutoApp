import type { VirtualFile } from "./types";
import { runQualityGate } from "./qualityGate";

export type RefactorPlan = {
  targetPath: string;
  action: "fix" | "improve" | "split" | "optimize" | "test" | "skip";
  impact: number;
  risk: number;
  complexity: number;
  roi: number;
  reason: string;
};

export function createRefactorPlan(input: {
  files: VirtualFile[];
  selectedPath?: string;
  missionCategory?: string;
}): RefactorPlan {
  const quality = runQualityGate(input.files);
  const targetPath = chooseTargetPath(input.files, input.selectedPath, input.missionCategory);
  const action = chooseAction(quality, targetPath, input.missionCategory);
  const impact = estimateImpact(quality, action);
  const risk = estimateRisk(targetPath, action);
  const complexity = estimateComplexity(input.files.find((file) => file.path === targetPath));
  const roi = Math.max(0, Math.min(100, impact - Math.round((risk + complexity) / 3)));

  return {
    targetPath,
    action: roi < 20 ? "skip" : action,
    impact,
    risk,
    complexity,
    roi,
    reason: "Selected " + action + " on " + targetPath + " from live workspace quality analysis.",
  };
}

function chooseTargetPath(files: VirtualFile[], selectedPath?: string, missionCategory?: string) {
  if (selectedPath && files.some((file) => file.path === selectedPath)) return selectedPath;

  if (missionCategory === "mobile" || missionCategory === "uiUx") {
    return files.find((file) => file.path === "/src/App.tsx")?.path || files[0]?.path || "";
  }

  return files.find((file) => file.path === "/src/App.tsx")?.path || files[0]?.path || "";
}

function chooseAction(quality: ReturnType<typeof runQualityGate>, targetPath: string, missionCategory?: string): RefactorPlan["action"] {
  if (quality.blockers.length) return "fix";
  if (missionCategory === "resilience") return "fix";
  if (missionCategory === "structure") return "split";
  if (missionCategory === "mobile" || missionCategory === "uiUx") return "improve";
  if (targetPath.includes(".test.")) return "test";
  return "improve";
}

function estimateImpact(quality: ReturnType<typeof runQualityGate>, action: RefactorPlan["action"]) {
  let impact = 40;
  if (quality.blockers.length) impact += 45;
  if (action === "fix") impact += 25;
  if (action === "improve") impact += 20;
  if (action === "split") impact += 15;
  return Math.max(0, Math.min(100, impact));
}

function estimateRisk(path: string, action: RefactorPlan["action"]) {
  let risk = 20;
  if (path.includes("api") || path.includes("core")) risk += 25;
  if (path.includes("App.tsx")) risk += 10;
  if (action === "split") risk += 15;
  return Math.max(0, Math.min(100, risk));
}

function estimateComplexity(file?: VirtualFile) {
  if (!file) return 80;
  const lines = String(file.content || "").split("\n").length;
  if (lines > 500) return 90;
  if (lines > 250) return 65;
  if (lines > 120) return 40;
  return 20;
    }
  
