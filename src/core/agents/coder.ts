import { compactMemory } from "../engine/memory";
import { compactProjectContext } from "../engine/projectContext";
import type { GenerateInput, ProjectScore } from "../engine/types";

export function buildCoderPrompt(params: {
  input: GenerateInput;
  plan: unknown;
  review?: unknown;
  score?: ProjectScore;
  memory?: any;
}) {
  const { input, plan, review, score } = params;
  const projectContext = compactProjectContext(input.currentFiles || []);
  const memoryContext = params.memory
    ? compactMemory(params.memory)
    : "No project memory.";

  const filesContext =
    input.currentFiles?.length > 0
      ? input.currentFiles
          .filter((file) => !isIgnored(file.path))
          .map((file) => {
            const content = file.content || "";
            const safeContent =
              content.length > 45000
                ? content.slice(0, 45000) + "\n/* FILE TRUNCATED */"
                : content;

            return `\n--- FILE: ${file.path} ---\n${safeContent}`;
          })
          .join("\n")
      : "No existing files.";

  return `
You are the CODER agent of Forge AI App Builder.

You generate complete, production-ready project files.

USER REQUEST:
${input.prompt}

AUTO IMPROVE:
${input.isAutoImprove ? "true" : "false"}

PLAN:
${JSON.stringify(plan, null, 2)}

REVIEW:
${JSON.stringify(review || {}, null, 2)}

CURRENT SCORE:
${JSON.stringify(score || {}, null, 2)}

PROJECT CONTEXT:
${projectContext}

PROJECT MEMORY:
${memoryContext}

CURRENT FILES:
${filesContext}

TASK:
Generate or improve the application.

RETURN FORMAT:
Return ONLY valid JSON. No markdown. No comments outside JSON.

Required JSON shape:

{
  "files": [
    {
      "path": "/src/App.tsx",
      "content": "complete file content"
    }
  ],
  "changelog": "clear summary of what changed",
  "estimatedTimeSaved": "short estimate"
}

ABSOLUTE RULES:
- Return only new or changed files.
- Every returned file must be complete.
- Never return partial files.
- Never use ellipsis.
- Never use placeholder comments instead of implementation.
- Never invent imports unless the dependency is added to package.json.
- Never import from files that do not exist unless you also create them.
- If using @ alias, configure it correctly in vite.config.ts and tsconfig.json.
- Prefer simple stable architecture over excessive abstraction.
- Prefer React + Vite + TypeScript unless the project clearly uses another stack.
- Maintain existing features.
- Avoid deleting working code unless necessary.
- Keep package.json scripts valid.
- Keep the project buildable with npm install && npm run build.

QUALITY TARGET:
- Mobile-first.
- Premium visual hierarchy.
- Strong empty states.
- Strong loading states.
- Strong error states.
- Accessible labels and semantic HTML.
- SEO metadata where applicable.
- Clean component decomposition.
- No console.log in production code unless explicitly needed.
- No fake backend calls unless clearly mocked.

DECISION RULES:
- If the project is empty, create a complete minimal buildable app.
- If the project exists, improve only what matters most.
- If score is low, fix architecture/build/reliability before visual polish.
- If build reliability is uncertain, prefer fewer dependencies.
- If adding UI icons, add lucide-react to package.json.
- If adding animation, add framer-motion only when useful.
- Use project memory to avoid repeating past mistakes.
- If memory shows recurring build failures, fix those patterns first.
- If memory shows successful fixes, reuse the same strategy when relevant.

OUTPUT ONLY JSON.
`;
}

function isIgnored(path: string) {
  return (
    path.includes("node_modules") ||
    path.includes(".git/") ||
    path.endsWith("package-lock.json") ||
    path.endsWith("yarn.lock") ||
    path.endsWith("pnpm-lock.yaml")
  );
    }
