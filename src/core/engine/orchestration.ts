import { buildCoderPrompt } from "../agents/coder";
import { buildPlannerPrompt } from "../agents/planner";
import { buildReviewerPrompt } from "../agents/reviewer";
import { mergeFiles } from "./fileMerge";
import { parseAiJson } from "./json";
import { scoreProject } from "./scoring";
import type { AiCaller, GenerateInput, GenerateOutput } from "./types";

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
    files: { path: string; content: string | null }[];
    changelog: string;
    estimatedTimeSaved: string;
  }>(coderRaw.text);

  const mergedFiles = mergeFiles(input.currentFiles || [], generated.files || []);
  const score = scoreProject(mergedFiles);

  const nextActions = buildNextActions(score);

  return {
    files: generated.files || [],
    changelog: generated.changelog || "Project updated.",
    estimatedTimeSaved: generated.estimatedTimeSaved || "Several hours saved.",
    score,
    nextActions,
    mode,
  };
}

function buildNextActions(score: ReturnType<typeof scoreProject>) {
  const actions: string[] = [];

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
