import type { VirtualFile } from "./types";

import {
  createArchitecturePlan,
  architecturePlanToPrompt,
} from "./architect";

import {
  createDesignSystemPlan,
  designSystemToPrompt,
} from "./designSystem";

import {
  createProductPlan,
  productPlanToPrompt,
} from "./planner";

import {
  qualityGateToPrompt,
  runQualityGate,
  type QualityGateResult,
} from "./qualityGate";

import { applyAutofix } from "./autofix";
import { createManualTestPlan, createSmokeTestFiles } from "./testGenerator";

export type ProfessionalPipelineContext = {
  productPlan: ReturnType<typeof createProductPlan>;
  architecturePlan: ReturnType<typeof createArchitecturePlan>;
  designSystem: ReturnType<typeof createDesignSystemPlan>;
  quality: QualityGateResult;
  promptContext: string;
};

export type ProfessionalPostProcessResult = {
  files: VirtualFile[];
  quality: QualityGateResult;
  changes: string[];
};

export function createProfessionalPipelineContext(input: {
  prompt: string;
  files: VirtualFile[];
}): ProfessionalPipelineContext {
  const productPlan = createProductPlan({
    prompt: input.prompt,
    files: input.files,
  });

  const architecturePlan = createArchitecturePlan({
    plan: productPlan,
    files: input.files,
  });

  const designSystem = createDesignSystemPlan();
  const quality = runQualityGate(input.files);

  const promptContext = [
    productPlanToPrompt(productPlan),
    "",
    architecturePlanToPrompt(architecturePlan),
    "",
    designSystemToPrompt(designSystem),
    "",
    qualityGateToPrompt(quality),
  ].join("\n");

  return {
    productPlan,
    architecturePlan,
    designSystem,
    quality,
    promptContext,
  };
}

export function createProfessionalGenerationPrompt(input: {
  prompt: string;
  files: VirtualFile[];
  mode: "create" | "improve" | "repair";
}) {
  const context = createProfessionalPipelineContext({
    prompt: input.prompt,
    files: input.files,
  });

  return [
    "PROFESSIONAL AUTONOMOUS PRODUCT PIPELINE",
    "",
    "Mode: " + input.mode,
    "",
    context.promptContext,
    "",
    "MANDATORY OUTPUT RULES:",
    "- Return complete files only.",
    "- Do not return placeholder-only screens.",
    "- Build a professional mobile-first product.",
    "- Implement real workflows, not static mockups.",
    "- Preserve existing valuable features.",
    "- Fix build issues before adding decorative features.",
    "- Add loading, empty, and error states.",
    "- Add local persistence where useful.",
    "- Prefer fewer complete features over many incomplete features.",
    "",
    "USER REQUEST:",
    input.prompt,
  ].join("\n");
}

export function applyProfessionalPostProcess(input: {
  files: VirtualFile[];
  includeTests?: boolean;
}): ProfessionalPostProcessResult {
  const qualityBefore = runQualityGate(input.files);

  const autofix = applyAutofix({
    files: input.files,
    quality: qualityBefore,
  });

  let files = autofix.files;
  const changes = [...autofix.changes];

  if (input.includeTests) {
    const smokeTests = createSmokeTestFiles(files);
    files = mergeByPath(files, smokeTests);
    if (smokeTests.length) {
      changes.push("Added smoke test file.");
    }
  }

  files = mergeByPath(files, [
    {
      path: "/AUTOAPP_QUALITY_REPORT.md",
      content: qualityGateToMarkdown(runQualityGate(files)),
    },
    {
      path: "/AUTOAPP_MANUAL_TEST_PLAN.md",
      content: createManualTestPlan(files),
    },
  ]);

  const quality = runQualityGate(files);

  return {
    files,
    quality,
    changes,
  };
}

export function chooseProfessionalFocus(quality: QualityGateResult) {
  const entries = Object.entries(quality.categories).sort(
    (a, b) => a[1] - b[1]
  );

  const weakest = entries[0]?.[0] || "productDepth";

  if (quality.blockers.length) return "repair_build_blockers";
  if (weakest === "mobile") return "improve_mobile_layout";
  if (weakest === "uiUx") return "improve_ui_ux";
  if (weakest === "resilience") return "improve_resilience";
  if (weakest === "productDepth") return "improve_product_depth";
  if (weakest === "structure") return "improve_architecture";

  return "improve_quality";
}

function qualityGateToMarkdown(quality: QualityGateResult) {
  return [
    "# AutoApp Quality Report",
    "",
    "Total: " + quality.total + "/100",
    "Passed: " + (quality.passed ? "yes" : "no"),
    "",
    "## Categories",
    "",
    ...Object.entries(quality.categories).map(
      ([key, value]) => "- " + key + ": " + value + "/100"
    ),
    "",
    "## Blockers",
    "",
    ...(quality.blockers.length
      ? quality.blockers.map((item) => "- " + item)
      : ["- none"]),
    "",
    "## Warnings",
    "",
    ...(quality.warnings.length
      ? quality.warnings.map((item) => "- " + item)
      : ["- none"]),
    "",
    "## Suggestions",
    "",
    ...(quality.suggestions.length
      ? quality.suggestions.map((item) => "- " + item)
      : ["- none"]),
    "",
  ].join("\n");
}

function mergeByPath(current: VirtualFile[], incoming: VirtualFile[]) {
  const map = new Map<string, VirtualFile>();

  for (const file of current) {
    map.set(file.path, file);
  }

  for (const file of incoming) {
    map.set(file.path, file);
  }

  return Array.from(map.values()).sort((a, b) =>
    a.path.localeCompare(b.path)
  );
}
