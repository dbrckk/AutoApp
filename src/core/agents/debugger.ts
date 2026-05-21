import type { VirtualFile } from "../engine/types";
import type { BuildIssue } from "../sandbox/errorParser";

export function buildDebuggerPrompt(params: {
  files: VirtualFile[];
  issues: BuildIssue[];
  buildLog: string;
}) {
  const filesContext = params.files
    .filter((file) => {
      if (!file.content) return false;
      if (file.path.includes("package-lock.json")) return false;
      if (file.content.length > 60_000) return false;
      return true;
    })
    .map((file) => {
      return `\n--- ${file.path} ---\n${file.content}`;
    })
    .join("\n");

  return `
You are the DEBUGGER agent of Forge AI.

The generated project has build/runtime errors.

BUILD ISSUES:
${JSON.stringify(params.issues, null, 2)}

RAW BUILD LOG:
${params.buildLog.slice(0, 25000)}

CURRENT FILES:
${filesContext}

TASK:
Fix the project.

Return ONLY valid JSON:

{
  "files": [
    {
      "path": "/src/example.tsx",
      "content": "complete corrected file content"
    }
  ],
  "changelog": "short fix summary",
  "estimatedTimeSaved": "short estimate"
}

Rules:
- Return only changed files.
- Every returned file must be complete.
- Fix root causes, not symptoms.
- Do not remove features unless required.
- If dependency is missing, update package.json.
- If an export is missing, add it or correct the import.
- If TypeScript is too strict, fix types correctly.
- Do not output markdown.
- Do not explain outside JSON.
`;
    }
