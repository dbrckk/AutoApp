import type { GenerateInput, ProjectScore, VirtualFile } from "../engine/types";

export function buildCoderPrompt(params: {
  input: GenerateInput;
  plan: unknown;
  review?: unknown;
  score?: ProjectScore;
}) {
  const { input, plan, review, score } = params;

  const filesContext =
    input.currentFiles?.length > 0
      ? input.currentFiles
          .filter((file) => !file.path.includes("package-lock.json"))
          .map((file) => {
            const content = file.content || "";
            const safeContent =
              content.length > 45000
                ? content.slice(0, 45000) + "\n/* FILE TRUNCATED FOR CONTEXT */"
                : content;

            return `\n--- ${file.path} ---\n${safeContent}`;
          })
          .join("\n")
      : "No existing files.";

  return `
You are the CODER agent of Forge AI.

USER REQUEST:
${input.prompt}

PLAN:
${JSON.stringify(plan, null, 2)}

REVIEW:
${JSON.stringify(review || {}, null, 2)}

CURRENT SCORE:
${JSON.stringify(score || {}, null, 2)}

CURRENT FILES:
${filesContext}

TASK:
Generate or improve the app.

Return ONLY valid JSON:

{
  "files": [
    {
      "path": "/src/example.tsx",
      "content": "complete file content"
    }
  ],
  "changelog": "clear summary",
  "estimatedTimeSaved": "short estimate"
}

Hard rules:
- Output only files that are new or changed.
- Every returned file must be complete.
- No markdown.
- No explanation outside JSON.
- No base64.
- No fake imports.
- Avoid packages unless added to package.json.
- Prefer clean TypeScript.
- Keep files modular.
- Mobile-first premium UI.
- Buildable Vite React project.
- If app is already good, improve deeper: UX, SEO, accessibility, error states, onboarding, dashboard, monetization, polish.
`;
}
