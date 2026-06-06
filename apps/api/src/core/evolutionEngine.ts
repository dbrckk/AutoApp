import type { QualityGateResult } from "./qualityGate";

export type EvolutionResult = {
  accepted: boolean;
  previousScore: number;
  nextScore: number;
  delta: number;
  reason: string;
};

export function evaluateEvolution(input: {
  previousQuality?: QualityGateResult | null;
  nextQuality: QualityGateResult;
}) {
  const previousScore = input.previousQuality?.total || 0;
  const nextScore = input.nextQuality.total;
  const delta = nextScore - previousScore;

  if (!input.previousQuality) {
    return {
      accepted: true,
      previousScore,
      nextScore,
      delta,
      reason: "No previous quality baseline exists.",
    } satisfies EvolutionResult;
  }

  if (input.nextQuality.blockers.length > input.previousQuality.blockers.length) {
    return {
      accepted: false,
      previousScore,
      nextScore,
      delta,
      reason: "Rejected because blocker count increased.",
    } satisfies EvolutionResult;
  }

  if (delta >= 0) {
    return {
      accepted: true,
      previousScore,
      nextScore,
      delta,
      reason: "Accepted because quality score did not regress.",
    } satisfies EvolutionResult;
  }

  if (delta >= -3 && input.nextQuality.blockers.length === 0) {
    return {
      accepted: true,
      previousScore,
      nextScore,
      delta,
      reason: "Accepted minor regression because there are no blockers.",
    } satisfies EvolutionResult;
  }

  return {
    accepted: false,
    previousScore,
    nextScore,
    delta,
    reason: "Rejected because quality regression is too high.",
  } satisfies EvolutionResult;
}

export function evolutionToPrompt(result: EvolutionResult) {
  return [
    "EVOLUTION REVIEW",
    "Accepted: " + (result.accepted ? "yes" : "no"),
    "Previous score: " + result.previousScore,
    "Next score: " + result.nextScore,
    "Delta: " + result.delta,
    "Reason: " + result.reason,
  ].join("\n");
      }
      
