import { buildCoderPrompt } from "../agents/coder";
import { buildDebuggerPrompt } from "../agents/debugger";
import { buildPlannerPrompt } from "../agents/planner";
import { buildReviewerPrompt } from "../agents/reviewer";
import { applyDependencyResolution } from "../intelligence/dependencyResolver";
import { runRealBuild } from "../sandbox/realBuildRunner";
import { virtualBuildCheck } from "../sandbox/virtualBuild";
import { mergeFiles } from "./fileMerge";
import { ensureArray, ensureString, parseAiJson } from "./json";
import { scoreProject } from "./scoring";
import type {
  AiCaller,
  BuildMode,
  GenerateInput,
  GenerateOutput,
  VirtualFile,
} from "./types";

type AiFileResponse = {
  files?: unknown;
  changelog?: unknown;
  estimatedTimeSaved?: unknown;
};

const MAX_REPAIR_ATTEMPTS = 5;

export async function orchestrateGeneration(
  input: GenerateInput,
  callAi: AiCaller
): Promise<GenerateOutput> {
  const mode = input.currentFiles?.length ? "improve" : "create";
  const buildMode = input.buildMode || "virtual";
  const safeCurrentFiles = sanitizeFiles(input.currentFiles || []);

  const plan = await safeJsonCall<any>(
    callAi,
    buildPlannerPrompt({
      ...input,
      currentFiles: safeCurrentFiles,
    }),
    {
      summary: "Fallback plan",
      targetStack: ["React", "Vite", "TypeScript"],
      requiredFiles: [],
      features: [],
      risks: ["Planner failed, using fallback plan."],
      qualityBar: ["Buildable", "Mobile-first", "Production-ready"],
    }
  );

  const initialScore = scoreProject(safeCurrentFiles);

  const review = safeCurrentFiles.length
    ? await safeJsonCall<any>(
        callAi,
        buildReviewerPrompt(safeCurrentFiles, initialScore),
        {
          summary: "Fallback review",
          issues: [],
          recommendations: [],
          nextActions: [],
        }
      )
    : null;

  const generated = await safeJsonCall<AiFileResponse>(
    callAi,
    buildCoderPrompt({
      input: {
        ...input,
        currentFiles: safeCurrentFiles,
      },
      plan,
      review,
      score: initialScore,
    }),
    {
      files: [],
      changelog: "AI generation failed to return valid files.",
      estimatedTimeSaved: "0 minutes",
    }
  );

  const generatedFiles = normalizeGeneratedFiles(generated.files);

  let mergedFiles = mergeFiles(safeCurrentFiles, generatedFiles);
  mergedFiles = applyDependencyResolution(mergedFiles);

  let finalChangedFiles = mergeFiles(
    generatedFiles,
    getPackageJsonPatch(mergedFiles)
  );

  let changelog = ensureString(
    generated.changelog,
    "Project generated or improved."
  );

  const estimatedTimeSaved = ensureString(
    generated.estimatedTimeSaved,
    "Several hours saved."
  );

  let buildResult = await runBuildCheck(mergedFiles, buildMode);

  if (!buildResult.ok) {
    for (let attempt = 1; attempt <= MAX_REPAIR_ATTEMPTS; attempt++) {
      const fixed = await safeJsonCall<AiFileResponse>(
        callAi,
        buildDebuggerPrompt({
          files: mergedFiles,
          issues: buildResult.issues,
          buildLog: buildResult.log,
        }),
        {
          files: [],
          changelog: `Repair ${attempt} failed to produce valid files.`,
          estimatedTimeSaved: "0 minutes",
        }
      );

      const fixedFiles = normalizeGeneratedFiles(fixed.files);

      if (fixedFiles.length === 0) {
        changelog += `\nRepair ${attempt}: no valid file patch returned.`;
        break;
      }

      mergedFiles = mergeFiles(mergedFiles, fixedFiles);
      mergedFiles = applyDependencyResolution(mergedFiles);

      finalChangedFiles = mergeFiles(finalChangedFiles, fixedFiles);
      finalChangedFiles = mergeFiles(
        finalChangedFiles,
        getPackageJsonPatch(mergedFiles)
      );

      changelog += `\nRepair ${attempt}: ${ensureString(
        fixed.changelog,
        "Build issues repaired."
      )}`;

      buildResult = await runBuildCheck(mergedFiles, buildMode);

      if (buildResult.ok) {
        changelog += `\nBuild check passed after repair ${attempt}.`;
        break;
      }
    }
  }

  const score = scoreProject(mergedFiles);
  const nextActions = buildNextActions(score, buildResult);

  return {
    files: finalChangedFiles,
    changelog: formatChangelog({
      changelog,
      buildOk: buildResult.ok,
      score: score.total,
      nextActions,
    }),
    estimatedTimeSaved,
    score,
    nextActions,
    mode: buildResult.ok ? mode : "repair",
  };
}

async function safeJsonCall<T>(
  callAi: AiCaller,
  prompt: string,
  fallback: T
): Promise<T> {
  try {
    const raw = await callAi(prompt);
    return parseAiJson<T>(raw.text);
  } catch {
    return fallback;
  }
}

async function runBuildCheck(files: VirtualFile[], buildMode: BuildMode) {
  if (buildMode === "none") {
    return {
      ok: true,
      issues: [],
      log: "",
    };
  }

  if (buildMode === "real") {
    return await runRealBuild(files);
  }

  return virtualBuildCheck(files);
}

function sanitizeFiles(files: VirtualFile[]) {
  return files
    .filter((file) => file?.path)
    .map((file) => ({
      path: normalizePath(file.path),
      content: file.content === null ? null : String(file.content || ""),
    }))
    .filter((file) => !isIgnoredFile(file.path));
}

function normalizeGeneratedFiles(files: unknown) {
  const seen = new Set<string>();

  return ensureArray<any>(files)
    .filter((file) => file?.path)
    .map((file) => ({
      path: normalizePath(ensureString(file.path)),
      content: file.content === null ? null : ensureString(file.content),
    }))
    .filter((file) => {
      if (isIgnoredFile(file.path)) return false;
      if (seen.has(file.path)) return false;
      seen.add(file.path);
      return true;
    });
}

function normalizePath(path: string) {
  if (!path) return "/";
  return path.startsWith("/") ? path : `/${path}`;
}

function isIgnoredFile(path: string) {
  return (
    path.includes("/node_modules/") ||
    path.includes("/.git/") ||
    path.endsWith("package-lock.json") ||
    path.endsWith("yarn.lock") ||
    path.endsWith("pnpm-lock.yaml")
  );
}

function getPackageJsonPatch(files: VirtualFile[]) {
  return files.filter((file) => normalizePath(file.path) === "/package.json");
}

function buildNextActions(
  score: ReturnType<typeof scoreProject>,
  buildResult: Awaited<ReturnType<typeof runBuildCheck>>
) {
  const actions: string[] = [];

  if (!buildResult.ok) {
    actions.push("Fix remaining build issues before publishing.");
  }

  if (score.architecture < 85) {
    actions.push("Improve project architecture and file separation.");
  }

  if (score.ui < 85) {
    actions.push("Improve visual hierarchy, spacing, states and animations.");
  }

  if (score.mobile < 90) {
    actions.push("Improve mobile-first responsive behavior.");
  }

  if (score.seo < 80) {
    actions.push("Add SEO metadata, sitemap, robots.txt and structured data.");
  }

  if (score.accessibility < 80) {
    actions.push(
      "Improve ARIA, contrast, keyboard navigation and semantic HTML."
    );
  }

  if (score.reliability < 80) {
    actions.push("Add error boundaries, empty states and safer fallbacks.");
  }

  if (score.monetization < 70) {
    actions.push(
      "Add monetization layer: pricing, checkout, affiliate or lead capture."
    );
  }

  if (actions.length === 0) {
    actions.push(
      "Project is close to publish-ready. Focus on final polish and deployment."
    );
  }

  return actions;
}

function formatChangelog(params: {
  changelog: string;
  buildOk: boolean;
  score: number;
  nextActions: string[];
}) {
  return [
    params.changelog.trim(),
    "",
    `Build status: ${params.buildOk ? "PASS" : "NEEDS_REPAIR"}`,
    `Quality score: ${params.score}/100`,
    "",
    "Next actions:",
    ...params.nextActions.map((action) => `- ${action}`),
  ].join("\n");
      }
