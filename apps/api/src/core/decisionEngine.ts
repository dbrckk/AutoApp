import type { QualityGateResult } from "./qualityGate";
import type { ProductMemory, ProductDecision } from "./productMemory";

export type DecisionInput = {
  memory: ProductMemory;
  quality: QualityGateResult;
  target: string;
  estimatedRisk?: number;
  estimatedImpact?: number;
};

export function makeProductDecision(input: DecisionInput): ProductDecision {
  const risk = clamp(input.estimatedRisk ?? estimateRisk(input));
  const impact = clamp(input.estimatedImpact ?? estimateImpact(input));
  const target = input.target || "project";
  const protectedTarget = input.memory.doNotRemove.some((item) =>
    target.toLowerCase().includes(item.toLowerCase())
  );

  if (protectedTarget && risk > 45) {
    return {
      at: Date.now(),
      type: "skip",
      target,
      reason: "Target is protected by product memory and risk is too high.",
      expectedImpact: impact - risk,
    };
  }

  if (input.quality.blockers.length > 0) {
    return {
      at: Date.now(),
      type: "improve",
      target: "build stability",
      reason: "Quality gate has blockers that must be fixed before feature work.",
      expectedImpact: 95,
    };
  }

  if (impact >= 70 && risk <= 55) {
    return {
      at: Date.now(),
      type: "improve",
      target,
      reason: "Expected impact is high and risk is acceptable.",
      expectedImpact: impact - Math.round(risk / 3),
    };
  }

  if (impact < 35) {
    return {
      at: Date.now(),
      type: "skip",
      target,
      reason: "Expected impact is too low for the current cycle.",
      expectedImpact: impact - risk,
    };
  }

  if (risk > 75) {
    return {
      at: Date.now(),
      type: "skip",
      target,
      reason: "Risk is too high compared to expected value.",
      expectedImpact: impact - risk,
    };
  }

  return {
    at: Date.now(),
    type: "improve",
    target,
    reason: "Balanced improvement selected by decision engine.",
    expectedImpact: impact - Math.round(risk / 2),
  };
}

export function decisionToPrompt(decision: ProductDecision) {
  return [
    "PRODUCT DECISION",
    "Type: " + decision.type,
    "Target: " + decision.target,
    "Reason: " + decision.reason,
    "Expected impact: " + decision.expectedImpact,
  ].join("\n");
}

function estimateRisk(input: DecisionInput) {
  let risk = 20;

  if (input.target.includes("auth")) risk += 30;
  if (input.target.includes("billing")) risk += 35;
  if (input.target.includes("database")) risk += 25;
  if (input.quality.total < 60) risk += 25;
  if (input.quality.blockers.length > 0) risk += 20;

  return risk;
}

function estimateImpact(input: DecisionInput) {
  let impact = 40;

  if (input.quality.blockers.length > 0) impact += 45;
  if (input.quality.categories.mobile < 75) impact += 20;
  if (input.quality.categories.uiUx < 75) impact += 20;
  if (input.quality.categories.productDepth < 75) impact += 20;
  if (input.quality.categories.resilience < 75) impact += 15;

  return impact;
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
  }
    
