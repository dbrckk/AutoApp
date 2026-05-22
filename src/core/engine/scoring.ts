import type { ProjectScore, VirtualFile } from "./types";

type Signals = {
  paths: string[];
  allContent: string;
  packageJson: any | null;
};

export function scoreProject(files: VirtualFile[]): ProjectScore {
  const signals = getSignals(files);

  const architecture = scoreArchitecture(signals);
  const ui = scoreUi(signals);
  const mobile = scoreMobile(signals);
  const performance = scorePerformance(signals);
  const accessibility = scoreAccessibility(signals);
  const seo = scoreSeo(signals);
  const maintainability = scoreMaintainability(signals);
  const monetization = scoreMonetization(signals);
  const reliability = scoreReliability(signals);

  const total = clamp(
    architecture * 0.16 +
      reliability * 0.16 +
      maintainability * 0.14 +
      mobile * 0.12 +
      ui * 0.12 +
      performance * 0.1 +
      accessibility * 0.08 +
      seo * 0.07 +
      monetization * 0.05
  );

  return {
    ui,
    mobile,
    performance,
    accessibility,
    seo,
    maintainability,
    architecture,
    monetization,
    reliability,
    total,
  };
}

function getSignals(files: VirtualFile[]): Signals {
  const paths = files.map((file) => normalizePath(file.path));
  const allContent = files
    .map((file) => file.content || "")
    .join("\n")
    .toLowerCase();

  return {
    paths,
    allContent,
    packageJson: readPackageJson(files),
  };
}

function scoreArchitecture(signals: Signals) {
  return clamp(
    20 +
      hasPath(signals, "/package.json") * 12 +
      hasAnyPath(signals, ["/vite.config.ts", "/vite.config.js", "/next.config.js"]) * 10 +
      hasAnyPath(signals, ["/src/main.tsx", "/src/main.jsx", "/app/page.tsx"]) * 10 +
      hasAnyPath(signals, ["/src/App.tsx", "/src/App.jsx"]) * 8 +
      countFolder(signals, "/components/") * 4 +
      countFolder(signals, "/lib/") * 5 +
      countFolder(signals, "/hooks/") * 4 +
      countFolder(signals, "/core/") * 4 +
      hasPath(signals, "/README.md") * 5 +
      hasPath(signals, "/.env.example") * 4
  );
}

function scoreUi(signals: Signals) {
  return clamp(
    25 +
      hasText(signals, ["rounded", "shadow", "border", "gradient", "backdrop"]) * 30 +
      hasText(signals, ["hover:", "transition", "duration", "ease-"]) * 15 +
      hasText(signals, ["empty", "loading", "skeleton", "spinner"]) * 15 +
      hasText(signals, ["card", "dashboard", "hero", "sidebar", "modal"]) * 15
  );
}

function scoreMobile(signals: Signals) {
  return clamp(
    25 +
      hasText(signals, ["sm:", "md:", "lg:", "xl:"]) * 25 +
      hasText(signals, ["grid", "flex", "min-h-screen", "max-w-"]) * 20 +
      hasText(signals, ["viewport", "responsive", "mobile-first"]) * 20 +
      hasText(signals, ["overflow-auto", "truncate", "wrap"]) * 10
  );
}

function scorePerformance(signals: Signals) {
  return clamp(
    35 +
      hasAnyPath(signals, ["/vite.config.ts", "/vite.config.js"]) * 15 +
      hasText(signals, ["lazy(", "dynamic", "memo", "usememo", "usecallback"]) * 15 +
      hasText(signals, ["manualchunks", "chunk", "sourcemap: false"]) * 15 +
      hasText(signals, ["image", "loading=\"lazy\"", "webp"]) * 10
  );
}

function scoreAccessibility(signals: Signals) {
  return clamp(
    25 +
      hasText(signals, ["aria-", "role=", "alt=", "label"]) * 35 +
      hasText(signals, ["button", "input", "select", "textarea"]) * 15 +
      hasText(signals, ["focus:", "focus-visible", "outline"]) * 15 +
      hasText(signals, ["semantic", "<main", "<section", "<nav", "<header"]) * 10
  );
}

function scoreSeo(signals: Signals) {
  return clamp(
    20 +
      hasText(signals, ["description", "og:title", "og:description", "twitter:card"]) * 35 +
      hasAnyPath(signals, ["/robots.txt"]) * 10 +
      hasAnyPath(signals, ["/sitemap.xml"]) * 10 +
      hasText(signals, ["structureddata", "json-ld", "schema.org"]) * 15 +
      hasPath(signals, "/README.md") * 10
  );
}

function scoreMaintainability(signals: Signals) {
  return clamp(
    25 +
      countFolder(signals, "/components/") * 5 +
      countFolder(signals, "/lib/") * 5 +
      countFolder(signals, "/hooks/") * 4 +
      hasText(signals, ["type ", "interface ", "export type", "export interface"]) * 15 +
      hasText(signals, ["try", "catch"]) * 10 +
      hasText(signals, ["eslint", "prettier", "vitest", "test"]) * 10
  );
}

function scoreMonetization(signals: Signals) {
  return clamp(
    15 +
      hasText(signals, ["pricing", "checkout", "stripe", "subscribe", "plan"]) * 35 +
      hasText(signals, ["affiliate", "deal", "commission", "lead", "conversion"]) * 35 +
      hasText(signals, ["cta", "call to action", "upgrade", "premium"]) * 15
  );
}

function scoreReliability(signals: Signals) {
  const scripts = signals.packageJson?.scripts || {};

  return clamp(
    25 +
      Number(Boolean(scripts.build)) * 15 +
      Number(Boolean(scripts.dev)) * 10 +
      hasText(signals, ["try", "catch", "finally"]) * 20 +
      hasText(signals, ["errorboundary", "fallback", "error state", "empty state"]) * 20 +
      hasPath(signals, "/.env.example") * 10 +
      hasText(signals, ["zod", "validate", "schema"]) * 10
  );
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

function normalizePath(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
}

function hasPath(signals: Signals, path: string) {
  return Number(signals.paths.includes(path));
}

function hasAnyPath(signals: Signals, paths: string[]) {
  return Number(paths.some((path) => signals.paths.includes(path)));
}

function countFolder(signals: Signals, folder: string) {
  return Math.min(5, signals.paths.filter((path) => path.includes(folder)).length);
}

function hasText(signals: Signals, keywords: string[]) {
  return Number(
    keywords.some((keyword) => signals.allContent.includes(keyword.toLowerCase()))
  );
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
    }
