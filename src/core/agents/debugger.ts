import { compactProjectContext } from "../engine/projectContext";
import type { VirtualFile } from "../engine/types";
import type { BuildIssue } from "../sandbox/errorParser";

export function buildDebuggerPrompt(params: {
  files: VirtualFile[];
  issues: BuildIssue[];
  buildLog: string;
}) {
  const projectContext = compactProjectContext(params.files);
  const relevantFiles = selectRelevantFiles(params.files, params.issues);

  const filesContext = relevantFiles
    .map((file) => {
      const content = file.content || "";
      const safeContent =
        content.length > 50000
          ? content.slice(0, 50000) + "\n/* FILE TRUNCATED */"
          : content;

      return `\n--- FILE: ${file.path} ---\n${safeContent}`;
    })
    .join("\n");

  return `
You are the DEBUGGER agent of Forge AI App Builder.

The project has build or runtime errors.

PROJECT CONTEXT:
${projectContext}

BUILD ISSUES:
${JSON.stringify(params.issues, null, 2)}

RAW BUILD LOG:
${params.buildLog.slice(0, 30000)}

RELEVANT FILES:
${filesContext}

TASK:
Fix the root cause of the errors.

RETURN FORMAT:
Return ONLY valid JSON. No markdown. No comments outside JSON.

{
  "files": [
    {
      "path": "/src/App.tsx",
      "content": "complete corrected file content"
    }
  ],
  "changelog": "short fix summary",
  "estimatedTimeSaved": "short estimate"
}

ABSOLUTE RULES:
- Return only changed files.
- Every returned file must be complete.
- Never return partial files.
- Never use ellipsis.
- Fix root causes, not symptoms.
- If dependency is missing, update package.json.
- If relative import is missing, create the file or correct the path.
- If named export is missing, add the export or fix the import.
- If TypeScript types are wrong, fix types cleanly.
- If Vite alias is broken, fix vite.config.ts and tsconfig.json.
- Keep package.json valid.
- Keep npm run build working.
- Do not replace the app with a trivial placeholder.
- Do not remove major features unless they directly cause failure.

OUTPUT ONLY JSON.
`;
}

function selectRelevantFiles(files: VirtualFile[], issues: BuildIssue[]) {
  const issueFiles = new Set(
    issues
      .map((issue) => issue.file)
      .filter(Boolean)
      .map((file) => normalizePath(file as string))
  );

  const alwaysUseful = new Set([
    "/package.json",
    "/vite.config.ts",
    "/vite.config.js",
    "/tsconfig.json",
    "/index.html",
    "/src/main.tsx",
    "/src/main.jsx",
    "/src/App.tsx",
    "/src/App.jsx",
  ]);

  const selected = files.filter((file) => {
    const path = normalizePath(file.path);

    if (!file.content) return false;
    if (isIgnored(path)) return false;
    if (issueFiles.has(path)) return true;
    if (alwaysUseful.has(path)) return true;

    return false;
  });

  if (selected.length > 0) return selected;

  return files.filter((file) => file.content && !isIgnored(file.path)).slice(0, 24);
}

function normalizePath(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
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
