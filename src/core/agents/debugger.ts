import type { VirtualFile } from "../engine/types";
import type { BuildIssue } from "../sandbox/errorParser";

export function buildDebuggerPrompt(params: {
  files: VirtualFile[];
  issues: BuildIssue[];
  buildLog: string;
}) {
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

The generated project has build or runtime errors.

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

Required JSON shape:

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
- If a dependency is missing, update package.json.
- If an import is wrong, correct the import or create the missing file.
- If an export is missing, add the export or fix the import.
- If TypeScript types are wrong, fix the types cleanly.
- Do not remove major features unless they directly cause the build failure.
- Do not replace the entire app with a trivial placeholder.
- Keep npm run build working.
- Keep package.json valid JSON.
- Keep TypeScript syntax valid.
- Avoid introducing new dependencies unless necessary.

COMMON FIX STRATEGIES:
- Missing module: add dependency to package.json or remove/replace import.
- Missing relative import: create the file or correct path.
- Bad named export: update export or import.
- JSX error: fix tags, fragments, prop names.
- Type mismatch: define clear local types.
- Vite alias error: update vite.config.ts and tsconfig.json.
- CSS/Tailwind error: simplify invalid classes.

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

  return files
    .filter((file) => file.content && !isIgnored(file.path))
    .slice(0, 20);
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
