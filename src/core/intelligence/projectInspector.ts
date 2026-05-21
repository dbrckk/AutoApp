import type { VirtualFile } from "../engine/types";

export type ProjectInspection = {
  framework: string;
  language: string;
  packageManager: string;
  dependencies: string[];
  devDependencies: string[];
  entrypoints: string[];
  missingCriticalFiles: string[];
  risks: string[];
  strengths: string[];
};

export function inspectProject(files: VirtualFile[]): ProjectInspection {
  const paths = files.map((file) => normalizePath(file.path));
  const packageJson = readPackageJson(files);

  const dependencies = Object.keys(packageJson?.dependencies || {});
  const devDependencies = Object.keys(packageJson?.devDependencies || {});
  const allDeps = [...dependencies, ...devDependencies];

  const framework = detectFramework(paths, allDeps);
  const language = detectLanguage(paths);
  const packageManager = detectPackageManager(paths);
  const entrypoints = detectEntrypoints(paths);
  const missingCriticalFiles = detectMissingCriticalFiles(paths, framework);
  const risks = detectRisks(files, framework, allDeps);
  const strengths = detectStrengths(files, framework, allDeps);

  return {
    framework,
    language,
    packageManager,
    dependencies,
    devDependencies,
    entrypoints,
    missingCriticalFiles,
    risks,
    strengths,
  };
}

function normalizePath(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
}

function readPackageJson(files: VirtualFile[]) {
  const file = files.find((item) => normalizePath(item.path) === "/package.json");
  if (!file?.content) return null;

  try {
    return JSON.parse(file.content);
  } catch {
    return null;
  }
}

function detectFramework(paths: string[], deps: string[]) {
  if (deps.includes("next")) return "Next.js";
  if (deps.includes("@vitejs/plugin-react") || paths.includes("/vite.config.ts")) return "Vite React";
  if (deps.includes("expo")) return "Expo";
  if (deps.includes("react-native")) return "React Native";
  if (deps.includes("astro")) return "Astro";
  if (deps.includes("vue")) return "Vue";
  if (deps.includes("svelte")) return "Svelte";
  if (deps.includes("@tauri-apps/api")) return "Tauri";
  if (deps.includes("electron")) return "Electron";
  if (deps.includes("react")) return "React";
  return "Unknown";
}

function detectLanguage(paths: string[]) {
  const tsCount = paths.filter((path) => path.endsWith(".ts") || path.endsWith(".tsx")).length;
  const jsCount = paths.filter((path) => path.endsWith(".js") || path.endsWith(".jsx")).length;

  if (tsCount > jsCount) return "TypeScript";
  if (jsCount > 0) return "JavaScript";
  return "Unknown";
}

function detectPackageManager(paths: string[]) {
  if (paths.includes("/pnpm-lock.yaml")) return "pnpm";
  if (paths.includes("/yarn.lock")) return "yarn";
  if (paths.includes("/package-lock.json")) return "npm";
  return "npm";
}

function detectEntrypoints(paths: string[]) {
  return paths.filter((path) =>
    [
      "/src/main.tsx",
      "/src/main.jsx",
      "/src/App.tsx",
      "/src/App.jsx",
      "/pages/index.tsx",
      "/app/page.tsx",
      "/server.ts",
      "/server.js",
      "/src/index.ts",
      "/src/index.tsx",
    ].includes(path)
  );
}

function detectMissingCriticalFiles(paths: string[], framework: string) {
  const missing: string[] = [];

  if (!paths.includes("/package.json")) missing.push("/package.json");
  if (!paths.includes("/README.md")) missing.push("/README.md");
  if (!paths.includes("/.env.example")) missing.push("/.env.example");

  if (framework === "Vite React") {
    if (!paths.includes("/index.html")) missing.push("/index.html");
    if (!paths.includes("/vite.config.ts") && !paths.includes("/vite.config.js")) {
      missing.push("/vite.config.ts");
    }
    if (!paths.includes("/src/main.tsx") && !paths.includes("/src/main.jsx")) {
      missing.push("/src/main.tsx");
    }
  }

  if (framework === "Next.js") {
    if (!paths.includes("/next.config.js") && !paths.includes("/next.config.ts")) {
      missing.push("/next.config.js");
    }
    if (!paths.includes("/app/page.tsx") && !paths.includes("/pages/index.tsx")) {
      missing.push("/app/page.tsx");
    }
  }

  return missing;
}

function detectRisks(files: VirtualFile[], framework: string, deps: string[]) {
  const risks: string[] = [];
  const allContent = files.map((file) => file.content || "").join("\n");

  if (framework === "Unknown") risks.push("Framework could not be detected.");
  if (!deps.length) risks.push("No dependencies detected.");
  if (allContent.includes("any")) risks.push("Loose TypeScript usage detected.");
  if (allContent.includes("console.log")) risks.push("Debug console logs detected.");
  if (!allContent.includes("try") && !allContent.includes("catch")) {
    risks.push("Weak error handling.");
  }
  if (!allContent.includes("aria-") && !allContent.includes("alt=")) {
    risks.push("Accessibility coverage appears weak.");
  }
  if (!allContent.includes("description") && !allContent.includes("og:title")) {
    risks.push("SEO metadata appears incomplete.");
  }

  return risks;
}

function detectStrengths(files: VirtualFile[], framework: string, deps: string[]) {
  const strengths: string[] = [];
  const paths = files.map((file) => normalizePath(file.path));
  const allContent = files.map((file) => file.content || "").join("\n");

  if (framework !== "Unknown") strengths.push(`${framework} detected.`);
  if (paths.some((path) => path.includes("/components/"))) strengths.push("Component structure detected.");
  if (paths.some((path) => path.includes("/lib/"))) strengths.push("Shared library layer detected.");
  if (deps.includes("tailwindcss")) strengths.push("Tailwind CSS detected.");
  if (allContent.includes("aria-") || allContent.includes("alt=")) strengths.push("Accessibility markers detected.");
  if (allContent.includes("og:title") || allContent.includes("twitter:card")) strengths.push("SEO/social metadata detected.");
  if (allContent.includes("try") && allContent.includes("catch")) strengths.push("Error handling detected.");

  return strengths;
}
