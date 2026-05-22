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
  const normalizedFiles = files.map((file) => ({
    ...file,
    path: normalizePath(file.path),
  }));

  const paths = normalizedFiles.map((file) => file.path);
  const packageJson = readPackageJson(normalizedFiles);

  const dependencies = Object.keys(packageJson?.dependencies || {});
  const devDependencies = Object.keys(packageJson?.devDependencies || {});
  const allDeps = [...dependencies, ...devDependencies];

  const framework = detectFramework(paths, allDeps, packageJson);
  const language = detectLanguage(paths);
  const packageManager = detectPackageManager(paths);
  const entrypoints = detectEntrypoints(paths, framework);
  const missingCriticalFiles = detectMissingCriticalFiles(paths, framework);
  const risks = detectRisks(normalizedFiles, framework, allDeps, packageJson);
  const strengths = detectStrengths(normalizedFiles, framework, allDeps);

  return {
    framework,
    language,
    packageManager,
    dependencies: dependencies.sort(),
    devDependencies: devDependencies.sort(),
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

function detectFramework(paths: string[], deps: string[], packageJson: any) {
  const scripts = packageJson?.scripts || {};
  const scriptText = Object.values(scripts).join(" ").toLowerCase();

  if (deps.includes("next") || paths.includes("/next.config.js") || paths.includes("/next.config.ts")) {
    return "Next.js";
  }

  if (
    deps.includes("expo") ||
    paths.includes("/app.json") ||
    paths.includes("/app.config.js") ||
    paths.includes("/app.config.ts")
  ) {
    return "Expo";
  }

  if (deps.includes("react-native")) return "React Native";
  if (deps.includes("astro") || paths.includes("/astro.config.mjs")) return "Astro";
  if (deps.includes("vue") || paths.includes("/src/App.vue")) return "Vue";
  if (deps.includes("svelte") || paths.includes("/svelte.config.js")) return "Svelte";
  if (deps.includes("@tauri-apps/api") || paths.includes("/src-tauri/tauri.conf.json")) return "Tauri";
  if (deps.includes("electron") || paths.includes("/electron/main.ts")) return "Electron";

  if (
    deps.includes("@vitejs/plugin-react") ||
    deps.includes("vite") ||
    paths.includes("/vite.config.ts") ||
    paths.includes("/vite.config.js") ||
    scriptText.includes("vite")
  ) {
    return "Vite React";
  }

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

function detectEntrypoints(paths: string[], framework: string) {
  const candidatesByFramework: Record<string, string[]> = {
    "Vite React": [
      "/index.html",
      "/src/main.tsx",
      "/src/main.jsx",
      "/src/App.tsx",
      "/src/App.jsx",
    ],
    "Next.js": [
      "/app/page.tsx",
      "/app/page.jsx",
      "/pages/index.tsx",
      "/pages/index.jsx",
    ],
    Expo: [
      "/App.tsx",
      "/App.jsx",
      "/app/index.tsx",
      "/app/_layout.tsx",
      "/index.js",
    ],
    "React Native": [
      "/App.tsx",
      "/App.jsx",
      "/index.js",
    ],
    Astro: [
      "/src/pages/index.astro",
      "/astro.config.mjs",
    ],
  };

  const candidates = candidatesByFramework[framework] || [
    "/src/main.tsx",
    "/src/main.jsx",
    "/src/App.tsx",
    "/src/App.jsx",
    "/app/page.tsx",
    "/pages/index.tsx",
    "/App.tsx",
    "/App.jsx",
  ];

  return candidates.filter((path) => paths.includes(path));
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

    if (!paths.includes("/src/App.tsx") && !paths.includes("/src/App.jsx")) {
      missing.push("/src/App.tsx");
    }
  }

  if (framework === "Next.js") {
    if (!paths.includes("/app/page.tsx") && !paths.includes("/pages/index.tsx")) {
      missing.push("/app/page.tsx or /pages/index.tsx");
    }
  }

  if (framework === "Expo") {
    if (
      !paths.includes("/App.tsx") &&
      !paths.includes("/App.jsx") &&
      !paths.includes("/app/index.tsx")
    ) {
      missing.push("/App.tsx or /app/index.tsx");
    }
  }

  return missing;
}

function detectRisks(
  files: VirtualFile[],
  framework: string,
  deps: string[],
  packageJson: any
) {
  const risks: string[] = [];
  const allContent = files.map((file) => file.content || "").join("\n");

  if (framework === "Unknown") risks.push("Framework could not be detected.");
  if (!packageJson) risks.push("package.json is missing or invalid.");
  if (!deps.length) risks.push("No dependencies detected.");
  if (/\bany\b/.test(allContent)) risks.push("Loose TypeScript any usage detected.");
  if (allContent.includes("console.log")) risks.push("Debug console logs detected.");
  if (!allContent.includes("try") || !allContent.includes("catch")) {
    risks.push("Weak error handling.");
  }
  if (!allContent.includes("aria-") && !allContent.includes("alt=")) {
    risks.push("Accessibility coverage appears weak.");
  }
  if (!allContent.includes("description") && !allContent.includes("og:title")) {
    risks.push("SEO metadata appears incomplete.");
  }

  const scripts = packageJson?.scripts || {};
  if (!scripts.build) risks.push("Missing build script.");
  if (!scripts.dev) risks.push("Missing dev script.");

  return unique(risks);
}

function detectStrengths(files: VirtualFile[], framework: string, deps: string[]) {
  const strengths: string[] = [];
  const paths = files.map((file) => normalizePath(file.path));
  const allContent = files.map((file) => file.content || "").join("\n");

  if (framework !== "Unknown") strengths.push(`${framework} detected.`);
  if (paths.some((path) => path.includes("/components/"))) {
    strengths.push("Component structure detected.");
  }
  if (paths.some((path) => path.includes("/lib/"))) {
    strengths.push("Shared library layer detected.");
  }
  if (paths.some((path) => path.includes("/hooks/"))) {
    strengths.push("Hooks layer detected.");
  }
  if (deps.includes("tailwindcss")) strengths.push("Tailwind CSS detected.");
  if (deps.includes("lucide-react")) strengths.push("Icon system detected.");
  if (allContent.includes("aria-") || allContent.includes("alt=")) {
    strengths.push("Accessibility markers detected.");
  }
  if (allContent.includes("og:title") || allContent.includes("twitter:card")) {
    strengths.push("SEO/social metadata detected.");
  }
  if (allContent.includes("try") && allContent.includes("catch")) {
    strengths.push("Error handling detected.");
  }

  return unique(strengths);
}

function unique(items: string[]) {
  return Array.from(new Set(items)).filter(Boolean);
      }
