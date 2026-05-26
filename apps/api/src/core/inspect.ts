import type { VirtualFile } from "./types";
import { normalizePath, readPackageJson } from "./files";

export function inspectProject(files: VirtualFile[]) {
  const paths = files.map((file) => normalizePath(file.path));

  const packageJson = readPackageJson(files);

  const dependencies = Object.keys(packageJson?.dependencies || {});
  const devDependencies = Object.keys(packageJson?.devDependencies || {});
  const allDependencies = [...dependencies, ...devDependencies];

  const framework = detectFramework({
    paths,
    dependencies: allDependencies,
  });

  const language = detectLanguage(paths);

  const entrypoints = paths.filter((path) =>
    [
      "/index.html",
      "/src/main.tsx",
      "/src/main.jsx",
      "/src/App.tsx",
      "/src/App.jsx",
      "/app/page.tsx",
      "/pages/index.tsx",
    ].includes(path)
  );

  const missingCriticalFiles = [
    !paths.includes("/package.json") ? "/package.json" : "",
    !paths.includes("/index.html") &&
    !paths.includes("/app/page.tsx") &&
    !paths.includes("/pages/index.tsx")
      ? "/index.html"
      : "",
    !paths.includes("/src/main.tsx") &&
    !paths.includes("/src/main.jsx") &&
    !paths.includes("/app/page.tsx") &&
    !paths.includes("/pages/index.tsx")
      ? "/src/main.tsx"
      : "",
    !paths.includes("/src/App.tsx") &&
    !paths.includes("/src/App.jsx") &&
    !paths.includes("/app/page.tsx") &&
    !paths.includes("/pages/index.tsx")
      ? "/src/App.tsx"
      : "",
  ].filter(Boolean);

  const risks = detectRisks({
    files,
    paths,
    packageJson,
    framework,
  });

  const strengths = detectStrengths({
    paths,
    framework,
    dependencies,
    devDependencies,
  });

  return {
    framework,
    language,
    packageManager: "npm",
    dependencies,
    devDependencies,
    entrypoints,
    missingCriticalFiles,
    risks,
    strengths,
  };
}

function detectFramework({
  paths,
  dependencies,
}: {
  paths: string[];
  dependencies: string[];
}) {
  if (
    dependencies.includes("next") ||
    paths.includes("/next.config.js") ||
    paths.includes("/next.config.ts") ||
    paths.includes("/app/page.tsx") ||
    paths.includes("/pages/index.tsx")
  ) {
    return "Next.js";
  }

  if (
    dependencies.includes("vite") ||
    paths.includes("/vite.config.ts") ||
    paths.includes("/vite.config.js")
  ) {
    return "Vite React";
  }

  if (dependencies.includes("react")) {
    return "React";
  }

  return "Unknown";
}

function detectLanguage(paths: string[]) {
  if (paths.some((path) => path.endsWith(".ts") || path.endsWith(".tsx"))) {
    return "TypeScript";
  }

  if (paths.some((path) => path.endsWith(".js") || path.endsWith(".jsx"))) {
    return "JavaScript";
  }

  return "Unknown";
}

function detectRisks({
  files,
  paths,
  packageJson,
  framework,
}: {
  files: VirtualFile[];
  paths: string[];
  packageJson: any;
  framework: string;
}) {
  const risks: string[] = [];

  const all = files
    .map((file) => file.content || "")
    .join("\n")
    .toLowerCase();

  if (framework === "Unknown") {
    risks.push("Framework could not be detected.");
  }

  if (!packageJson) {
    risks.push("Missing or invalid package.json.");
  }

  if (packageJson && !packageJson.scripts?.build) {
    risks.push("Missing build script.");
  }

  if (packageJson && !packageJson.scripts?.dev) {
    risks.push("Missing dev script.");
  }

  if (!paths.includes("/README.md")) {
    risks.push("Missing README.md.");
  }

  if (!paths.includes("/.env.example")) {
    risks.push("Missing .env.example.");
  }

  if (all.includes("todo")) {
    risks.push("TODO markers remain in the codebase.");
  }

  if (all.includes("lorem ipsum")) {
    risks.push("Placeholder lorem ipsum text remains.");
  }

  if (all.includes("console.log")) {
    risks.push("console.log statements remain.");
  }

  if (all.includes("dangerouslysetinnerhtml")) {
    risks.push("dangerouslySetInnerHTML is used; verify sanitization.");
  }

  if (files.length > 80) {
    risks.push("Large generated project; verify maintainability and bundle size.");
  }

  return risks;
}

function detectStrengths({
  paths,
  framework,
  dependencies,
  devDependencies,
}: {
  paths: string[];
  framework: string;
  dependencies: string[];
  devDependencies: string[];
}) {
  const strengths: string[] = [];

  if (framework !== "Unknown") {
    strengths.push(`${framework} detected.`);
  }

  if (paths.includes("/vite.config.ts") || paths.includes("/vite.config.js")) {
    strengths.push("Vite configuration present.");
  }

  if (paths.includes("/tsconfig.json")) {
    strengths.push("TypeScript configuration present.");
  }

  if (paths.includes("/README.md")) {
    strengths.push("README documentation present.");
  }

  if (paths.includes("/.env.example")) {
    strengths.push("Environment example present.");
  }

  if (paths.includes("/robots.txt")) {
    strengths.push("robots.txt present.");
  }

  if (paths.includes("/sitemap.xml")) {
    strengths.push("sitemap.xml present.");
  }

  if (dependencies.includes("@capacitor/core")) {
    strengths.push("Capacitor runtime dependency present.");
  }

  if (devDependencies.includes("@capacitor/android")) {
    strengths.push("Android Capacitor dependency present.");
  }

  return strengths;
      }
