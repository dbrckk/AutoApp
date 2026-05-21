import { buildCoderPrompt } from "../agents/coder";
import { buildDebuggerPrompt } from "../agents/debugger";
import { buildPlannerPrompt } from "../agents/planner";
import { buildReviewerPrompt } from "../agents/reviewer";
import { virtualBuildCheck } from "../sandbox/virtualBuild";
import { mergeFiles } from "./fileMerge";
import { parseAiJson } from "./json";
import { scoreProject } from "./scoring";
import type { AiCaller, GenerateInput, GenerateOutput, VirtualFile } from "./types";

export async function orchestrateGeneration(
  input: GenerateInput,
  callAi: AiCaller
): Promise<GenerateOutput> {
  const mode = input.currentFiles?.length ? "improve" : "create";

  const plannerRaw = await callAi(buildPlannerPrompt(input));
  const plan = parseAiJson(plannerRaw.text);

  const initialScore = scoreProject(input.currentFiles || []);

  let review = null;

  if (input.currentFiles?.length) {
    const reviewerRaw = await callAi(buildReviewerPrompt(input.currentFiles, initialScore));
    review = parseAiJson(reviewerRaw.text);
  }

  const coderRaw = await callAi(
    buildCoderPrompt({
      input,
      plan,
      review,
      score: initialScore,
    })
  );

  const generated = parseAiJson<{
    files: VirtualFile[];
    changelog: string;
    estimatedTimeSaved: string;
  }>(coderRaw.text);

  let mergedFiles = mergeFiles(input.currentFiles || [], generated.files || []);
  let buildResult = virtualBuildCheck(mergedFiles);

  let finalGeneratedFiles = generated.files || [];
  let changelog = generated.changelog || "Project updated.";

  if (!buildResult.ok) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      const debuggerRaw = await callAi(
        buildDebuggerPrompt({
          files: mergedFiles,
          issues: buildResult.issues,
          buildLog: buildResult.log,
        })
      );

      const fixed = parseAiJson<{
        files: VirtualFile[];
        changelog: string;
        estimatedTimeSaved: string;
      }>(debuggerRaw.text);

      mergedFiles = mergeFiles(mergedFiles, fixed.files || []);
      finalGeneratedFiles = mergeFiles(finalGeneratedFiles, fixed.files || []);
      changelog += `\nRepair ${attempt}: ${fixed.changelog || "Build issues repaired."}`;

      buildResult = virtualBuildCheck(mergedFiles);

      if (buildResult.ok) break;
    }
  }

  const score = scoreProject(mergedFiles);
  const nextActions = buildNextActions(score, buildResult);

  return {
    files: finalGeneratedFiles,
    changelog,
    estimatedTimeSaved: generated.estimatedTimeSaved || "Several hours saved.",
    score,
    nextActions,
    mode: buildResult.ok ? mode : "repair",
  };
}

function buildNextActions(
  score: ReturnType<typeof scoreProject>,
  buildResult: ReturnType<typeof virtualBuildCheck>
) {
  const actions: string[] = [];

  if (!buildResult.ok) {
    actions.push("Fix remaining virtual build issues.");
  }

  if (score.architecture < 85) actions.push("Improve project architecture and file separation.");
  if (score.ui < 85) actions.push("Improve visual hierarchy, spacing, states and animations.");
  if (score.mobile < 90) actions.push("Improve mobile-first responsive behavior.");
  if (score.seo < 80) actions.push("Add SEO metadata, sitemap, robots.txt and structured data.");
  if (score.accessibility < 80) actions.push("Improve ARIA, contrast, keyboard navigation and semantic HTML.");
  if (score.reliability < 80) actions.push("Add error boundaries, empty states and safer fallbacks.");
  if (score.monetization < 70) actions.push("Add monetization layer: pricing, checkout, affiliate or lead capture.");

  if (actions.length === 0) {
    actions.push("Project is close to publish-ready. Focus on final polish and real deployment.");
  }

  return actions;
}
