import type { QualityGateResult } from "./qualityGate";
import type { ProductMemory } from "./productMemory";

export type Mission = {
  id: string;
  title: string;
  objective: string;
  targetScore: number;
  priority: number;
  category: string;
  status: "todo" | "doing" | "review" | "done";
  createdAt: number;
  estimatedMinutes: number;
};

export function createMission(input: {
  memory: ProductMemory;
  quality: QualityGateResult;
}): Mission {
  const weakest = Object.entries(input.quality.categories).sort(
    (a, b) => a[1] - b[1]
  )[0];

  const category = weakest?.[0] || "quality";
  const current = Number(weakest?.[1] || input.quality.total || 0);

  return {
    id: cryptoRandomId(),
    title: createTitle(category, input.quality.blockers.length),
    objective: createObjective(category, input.quality),
    targetScore: Math.min(100, Math.max(85, current + 15)),
    priority: createPriority(category, input.quality),
    category,
    status: "todo",
    createdAt: Date.now(),
    estimatedMinutes: estimateMinutes(category, input.quality),
  };
}

export function createBacklog(input: {
  memory: ProductMemory;
  quality: QualityGateResult;
}) {
  const missions: Mission[] = [];

  if (input.quality.blockers.length) {
    missions.push({
      id: cryptoRandomId(),
      title: "Fix build blockers",
      objective: input.quality.blockers.join("; "),
      targetScore: 100,
      priority: 100,
      category: "buildability",
      status: "todo",
      createdAt: Date.now(),
      estimatedMinutes: 20,
    });
  }

  for (const [category, score] of Object.entries(input.quality.categories)) {
    if (score < 85) {
      missions.push({
        id: cryptoRandomId(),
        title: createTitle(category, 0),
        objective: "Raise " + category + " from " + score + " to at least 85.",
        targetScore: 85,
        priority: Math.max(10, 100 - score),
        category,
        status: "todo",
        createdAt: Date.now(),
        estimatedMinutes: estimateMinutes(category, input.quality),
      });
    }
  }

  return missions.sort((a, b) => b.priority - a.priority).slice(0, 12);
}

export function missionToPrompt(mission: Mission) {
  return [
    "CURRENT MISSION",
    "Title: " + mission.title,
    "Objective: " + mission.objective,
    "Category: " + mission.category,
    "Target score: " + mission.targetScore,
    "Priority: " + mission.priority,
    "Estimated minutes: " + mission.estimatedMinutes,
  ].join("\n");
}

function createTitle(category: string, blockerCount: number) {
  if (blockerCount > 0) return "Fix critical blockers";
  if (category === "mobile") return "Improve mobile UX";
  if (category === "uiUx") return "Upgrade visual hierarchy and UX";
  if (category === "productDepth") return "Deepen product workflows";
  if (category === "resilience") return "Add resilient states and persistence";
  if (category === "structure") return "Improve architecture structure";
  if (category === "buildability") return "Improve build stability";
  return "Improve product quality";
}

function createObjective(category: string, quality: QualityGateResult) {
  if (quality.blockers.length) {
    return "Remove blockers: " + quality.blockers.join("; ");
  }

  return "Raise " + category + " quality while preserving existing product memory.";
}

function createPriority(category: string, quality: QualityGateResult) {
  if (quality.blockers.length) return 100;
  const score = Number((quality.categories as any)[category] || quality.total);
  return Math.max(1, Math.min(99, 100 - score));
}

function estimateMinutes(category: string, quality: QualityGateResult) {
  if (quality.blockers.length) return 20;
  if (category === "productDepth") return 35;
  if (category === "uiUx") return 25;
  if (category === "mobile") return 20;
  return 15;
}

function cryptoRandomId() {
  return "mission_" + Math.random().toString(36).slice(2, 10);
    }
                               
