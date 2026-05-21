import type { VirtualFile } from "./types";

export type ProjectContext = {
  fileCount: number;
  importantFiles: string[];
  components: string[];
  routes: string[];
  styles: string[];
  configs: string[];
  packageSummary: {
    scripts: Record<string, string>;
    dependencies: string[];
    devDependencies: string[];
  } | null;
  notes: string[];
};

export function buildProjectContext(files: VirtualFile[]): ProjectContext {
  const paths = files.map((file) => normalizePath(file.path));

  return {
    fileCount: files.length,
    importantFiles: paths.filter(isImportantFile),
    components: paths.filter((path) => path.includes("/components/")),
    routes: paths.filter(
      (path) =>
        path.includes("/pages/") ||
        path.includes("/app/") ||
        path.includes("/routes/")
    ),
    styles: paths.filter(
      (path) =>
        path.endsWith(".css") ||
        path.endsWith(".scss") ||
        path.endsWith(".less")
    ),
    configs: paths.filter(isConfigFile),
    packageSummary: summarizePackage(files),
    notes: buildNotes(files),
  };
}

export function compactProjectContext(files: VirtualFile[]) {
  const context = buildProjectContext(files);

  return JSON.stringify(
    {
      fileCount: context.fileCount,
      importantFiles: context.importantFiles,
      components: context.components.slice(0, 40),
      routes: context.routes.slice(0, 30),
      styles: context.styles,
      configs: context.configs,
      packageSummary: context.packageSummary,
      notes: context.notes,
    },
    null,
    2
  );
}

function normalizePath(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
}

function isImportantFile(path: string) {
  return [
    "/package.json",
    "/index.html",
    "/vite.config.ts",
    "/vite.config.js",
    "/tsconfig.json",
    "/src/main.tsx",
    "/src/main.jsx",
    "/src/App.tsx",
    "/src/App.jsx",
    "/README.md",
    "/.env.example",
  ].includes(path);
}

function isConfigFile(path: string) {
  return (
    path.endsWith("package.json") ||
    path.endsWith("vite.config.ts") ||
    path.endsWith("vite.config.js") ||
    path.endsWith("tsconfig.json") ||
    path.endsWith("tailwind.config.ts") ||
    path.endsWith("tailwind.config.js") ||
    path.endsWith("postcss.config.js") ||
    path.endsWith("vercel.json")
  );
}

function summarizePackage(files: VirtualFile[]) {
  const packageFile = files.find(
    (file) => normalizePath(file.path) === "/package.json"
  );

  if (!packageFile?.content) return null;

  try {
    const json = JSON.parse(packageFile.content);

    return {
      scripts: json.scripts || {},
      dependencies: Object.keys(json.dependencies || {}),
      devDependencies: Object.keys(json.devDependencies || {}),
    };
  } catch {
    return null;
  }
}

function buildNotes(files: VirtualFile[]) {
  const notes: string[] = [];
  const all = files.map((file) => file.content || "").join("\n");

  if (all.includes("TODO")) notes.push("TODO markers detected.");
  if (all.includes("console.log")) notes.push("console.log usage detected.");
  if (all.includes("any")) notes.push("Loose TypeScript any usage detected.");
  if (!all.includes("try") || !all.includes("catch")) {
    notes.push("Error handling appears limited.");
  }
  if (!all.includes("aria-") && !all.includes("alt=")) {
    notes.push("Accessibility markers appear limited.");
  }

  return notes;
                      }
