import type { ProjectScore, VirtualFile } from "../engine/types";

export function buildReviewerPrompt(files: VirtualFile[], score: ProjectScore) {
  const fileList = files.map((f) => f.path).join("\n");

  return `
You are the REVIEWER agent of Forge AI.

CURRENT PROJECT SCORE:
${JSON.stringify(score, null, 2)}

FILES:
${fileList}

TASK:
Review the project and find the highest-impact improvements.

Return ONLY valid JSON:

{
  "summary": "short review",
  "issues": ["issue"],
  "recommendations": ["recommendation"],
  "nextActions": ["action"]
}

Focus on:
- broken architecture
- missing files
- mobile UI
- SEO
- performance
- maintainability
- production readiness
`;
}
