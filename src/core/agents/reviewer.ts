import type { ProjectScore, VirtualFile } from "../engine/types";

export function buildReviewerPrompt(files: VirtualFile[], score: ProjectScore) {
  const fileList = files.map((file) => file.path).join("\n");
  const summary = summarizeFiles(files);

  return `
You are the REVIEWER agent of Forge AI App Builder.

You review the current project and produce high-impact improvement tasks.

CURRENT PROJECT SCORE:
${JSON.stringify(score, null, 2)}

FILES:
${fileList}

PROJECT SUMMARY:
${summary}

TASK:
Review the project and identify the best next improvements.

RETURN FORMAT:
Return ONLY valid JSON. No markdown. No commentary.

Required JSON shape:

{
  "summary": "short review",
  "issues": ["specific issue"],
  "recommendations": ["specific recommendation"],
  "nextActions": ["direct task for the coder agent"]
}

REVIEW PRIORITY ORDER:
1. Build reliability.
2. Missing critical files.
3. Broken imports/exports.
4. Dependency consistency.
5. Architecture and component separation.
6. Mobile-first UX.
7. Accessibility.
8. SEO.
9. Error/loading/empty states.
10. Performance.
11. Monetization.
12. Visual polish.

RULES:
- Be specific.
- Avoid generic advice.
- Every nextAction must be directly executable by the coder agent.
- Do not ask questions.
- Do not suggest impossible external services unless requested.
- If the project is already good, suggest deeper polish and production readiness.
- If the score is low, focus on the lowest categories first.
- Keep recommendations compatible with the existing stack.

OUTPUT ONLY JSON.
`;
}

function summarizeFiles(files: VirtualFile[]) {
  const packageJson = files.find((file) => file.path.endsWith("package.json"));
  const appFile = files.find(
    (file) => file.path.endsWith("/src/App.tsx") || file.path === "/src/App.tsx"
  );

  const packageSummary = packageJson?.content
    ? safePackageSummary(packageJson.content)
    : "No package.json detected.";

  const appSummary = appFile?.content
    ? appFile.content.slice(0, 4000)
    : "No App file detected.";

  return `
PACKAGE:
${packageSummary}

APP EXCERPT:
${appSummary}
`;
}

function safePackageSummary(content: string) {
  try {
    const json = JSON.parse(content);

    return JSON.stringify(
      {
        scripts: json.scripts || {},
        dependencies: json.dependencies || {},
        devDependencies: json.devDependencies || {},
      },
      null,
      2
    );
  } catch {
    return "package.json is invalid JSON.";
  }
}
