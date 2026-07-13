import type { VirtualFile } from "./types";

export type QualityGateResult = {
  total: number;
  passed: boolean;
  categories: {
    buildability: number;
    structure: number;
    uiUx: number;
    mobile: number;
    resilience: number;
    productDepth: number;
  };
  blockers: string[];
  warnings: string[];
  suggestions: string[];
};

type ProjectIndex = {
  files: VirtualFile[];
  paths: string[];
  content: string;
  packageJson: Record<string, any> | null;
  packageJsonInvalid: boolean;
  duplicatePaths: string[];
  brokenImports: string[];
};

export function runQualityGate(files: VirtualFile[]): QualityGateResult {
  const index = buildIndex(files);
  const categories = {
    buildability: scoreBuildability(index),
    structure: scoreStructure(index),
    uiUx: scoreUiUx(index.content),
    mobile: scoreMobile(index.content),
    resilience: scoreResilience(index.content),
    productDepth: scoreProductDepth(index.content),
  };
  const blockers = createBlockers(index);
  const warnings = createWarnings(index, categories);
  const suggestions = createSuggestions(categories, blockers, warnings);
  const total = Math.round(
    categories.buildability * 0.28 +
      categories.structure * 0.14 +
      categories.uiUx * 0.16 +
      categories.mobile * 0.12 +
      categories.resilience * 0.16 +
      categories.productDepth * 0.14
  );
  return { total, passed: total >= 78 && blockers.length === 0, categories, blockers, warnings, suggestions };
}

export function qualityGateToPrompt(result: QualityGateResult) {
  return [
    "QUALITY GATE",
    `Total: ${result.total}/100`,
    `Passed: ${result.passed ? "yes" : "no"}`,
    "",
    "Categories:",
    ...Object.entries(result.categories).map(([key, value]) => `- ${key}: ${value}/100`),
    "",
    "Blockers:",
    ...(result.blockers.length ? result.blockers.map((item) => `- ${item}`) : ["- none"]),
    "",
    "Warnings:",
    ...(result.warnings.length ? result.warnings.map((item) => `- ${item}`) : ["- none"]),
    "",
    "Suggestions:",
    ...(result.suggestions.length ? result.suggestions.map((item) => `- ${item}`) : ["- none"]),
  ].join("\n");
}

function buildIndex(files: VirtualFile[]): ProjectIndex {
  const normalized = files.map((file) => ({ ...file, path: normalizePath(file.path) }));
  const paths = normalized.map((file) => file.path);
  const counts = new Map<string, number>();
  for (const path of paths) counts.set(path, (counts.get(path) || 0) + 1);
  const duplicatePaths = [...counts].filter(([, count]) => count > 1).map(([path]) => path);
  const packageFile = normalized.find((file) => file.path === "/package.json");
  let packageJson: Record<string, any> | null = null;
  let packageJsonInvalid = false;
  if (packageFile?.content) {
    try { packageJson = JSON.parse(packageFile.content); } catch { packageJsonInvalid = true; }
  }
  return {
    files: normalized,
    paths,
    content: normalized.map((file) => file.content || "").join("\n"),
    packageJson,
    packageJsonInvalid,
    duplicatePaths,
    brokenImports: findBrokenRelativeImports(normalized),
  };
}

function scoreBuildability(index: ProjectIndex) {
  let score = 0;
  if (index.packageJson && !index.packageJsonInvalid) score += 22;
  if (index.packageJson?.scripts?.build) score += 14;
  if (index.paths.includes("/index.html")) score += 12;
  if (hasAny(index.paths, ["/src/main.tsx", "/src/main.jsx", "/src/main.ts", "/src/main.js"])) score += 16;
  if (hasAny(index.paths, ["/src/App.tsx", "/src/App.jsx", "/src/App.ts", "/src/App.js"])) score += 12;
  if (!index.duplicatePaths.length) score += 10;
  if (!index.brokenImports.length) score += 14;
  return clamp(score);
}

function scoreStructure(index: ProjectIndex) {
  let score = 10;
  if (index.paths.some((path) => path.includes("/components/"))) score += 20;
  if (index.paths.some((path) => path.includes("/lib/") || path.includes("/services/"))) score += 18;
  if (index.paths.some((path) => path.includes("/hooks/"))) score += 15;
  if (index.paths.length >= 8) score += 12;
  if (index.paths.length >= 15) score += 10;
  if (index.paths.some((path) => /test|spec/i.test(path))) score += 15;
  return clamp(score);
}

function scoreUiUx(content: string) {
  let score = 0;
  if (/loading|busy|pending/i.test(content)) score += 18;
  if (/empty|no results|no data/i.test(content)) score += 14;
  if (/error|failed|retry|recovery/i.test(content)) score += 18;
  if (/aria-|role=|htmlFor=|tabIndex/i.test(content)) score += 14;
  if (/onClick|onSubmit|onChange|onKeyDown/i.test(content)) score += 14;
  if (/focus:|focus-visible:|hover:|active:/i.test(content)) score += 10;
  if (/modal|dialog|toast|notification/i.test(content)) score += 12;
  return clamp(score);
}

function scoreMobile(content: string) {
  let score = 0;
  if (/width=device-width/i.test(content)) score += 20;
  if (/sm:|md:|lg:|xl:|@media/i.test(content)) score += 22;
  if (/100dvh|safe-area|env\(safe-area/i.test(content)) score += 18;
  if (/overflow-x-hidden|min-w-0|max-w-|w-full/i.test(content)) score += 16;
  if (/flex-wrap|grid-cols-1|overflow-x-auto/i.test(content)) score += 12;
  if (/min-h-1[01]|min-h-12|active:scale/i.test(content)) score += 12;
  return clamp(score);
}

function scoreResilience(content: string) {
  let score = 0;
  if (/try\s*\{|catch\s*\(/i.test(content)) score += 18;
  if (/AbortController|timeout|retry/i.test(content)) score += 16;
  if (/ErrorBoundary|getDerivedStateFromError|componentDidCatch/i.test(content)) score += 16;
  if (/localStorage|indexedDB|persist/i.test(content)) score += 14;
  if (/Array\.isArray|typeof\s+\w+|normalize/i.test(content)) score += 14;
  if (/disabled=|loading|busy|pending/i.test(content)) score += 12;
  if (/fallback|recovery|graceful/i.test(content)) score += 10;
  return clamp(score);
}

function scoreProductDepth(content: string) {
  let score = 0;
  if (/fetch\(|request\(|api\//i.test(content)) score += 18;
  if (/history|timeline|activity|logs/i.test(content)) score += 14;
  if (/settings|preferences|configuration/i.test(content)) score += 12;
  if (/export|download|publish|deploy/i.test(content)) score += 14;
  if (/analytics|metric|score|report/i.test(content)) score += 14;
  if (/onboarding|wizard|create|generate/i.test(content)) score += 12;
  if (/pipeline|queue|job|workflow/i.test(content)) score += 16;
  return clamp(score);
}

function createBlockers(index: ProjectIndex) {
  const blockers: string[] = [];
  if (!index.paths.includes("/package.json")) blockers.push("Missing package.json.");
  if (index.packageJsonInvalid) blockers.push("package.json is invalid JSON.");
  if (!index.paths.includes("/index.html")) blockers.push("Missing index.html.");
  if (!hasAny(index.paths, ["/src/main.tsx", "/src/main.jsx", "/src/main.ts", "/src/main.js"])) blockers.push("Missing application entry file.");
  if (!hasAny(index.paths, ["/src/App.tsx", "/src/App.jsx", "/src/App.ts", "/src/App.js"])) blockers.push("Missing App component.");
  if (index.duplicatePaths.length) blockers.push(`Duplicate file paths: ${index.duplicatePaths.slice(0, 5).join(", ")}.`);
  for (const item of index.brokenImports.slice(0, 8)) blockers.push(`Broken relative import: ${item}.`);
  if (/placeholder-only|lorem ipsum|TODO:\s*implement|not implemented/i.test(index.content)) blockers.push("Incomplete placeholder implementation detected.");
  return blockers;
}

function createWarnings(index: ProjectIndex, categories: QualityGateResult["categories"]) {
  const warnings: string[] = [];
  if (!index.paths.some((path) => /test|spec/i.test(path))) warnings.push("No automated test file detected.");
  if (!/ErrorBoundary|getDerivedStateFromError|componentDidCatch/i.test(index.content)) warnings.push("No render error boundary detected.");
  if (!/AbortController|timeout/i.test(index.content)) warnings.push("Network timeout or cancellation handling is not visible.");
  if (categories.mobile < 75) warnings.push("Mobile resilience is below release threshold.");
  if (categories.resilience < 75) warnings.push("Runtime resilience is below release threshold.");
  return warnings;
}

function createSuggestions(categories: QualityGateResult["categories"], blockers: string[], warnings: string[]) {
  const suggestions: string[] = [];
  if (blockers.length) suggestions.push("Resolve every blocker before adding new features.");
  for (const [name, score] of Object.entries(categories).sort((a, b) => a[1] - b[1]).slice(0, 3)) {
    if (score < 90) suggestions.push(`Raise ${name} from ${score}/100 with a focused improvement pass.`);
  }
  suggestions.push(...warnings);
  return [...new Set(suggestions)].slice(0, 10);
}

function findBrokenRelativeImports(files: VirtualFile[]) {
  const paths = new Set(files.map((file) => normalizePath(file.path)));
  const broken: string[] = [];
  const pattern = /from\s+["'](\.{1,2}\/[^"']+)["']/g;
  for (const file of files.filter((item) => /\.(tsx?|jsx?)$/i.test(item.path))) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(file.content || ""))) {
      const resolved = resolveRelative(file.path, match[1]);
      const candidates = [resolved, `${resolved}.ts`, `${resolved}.tsx`, `${resolved}.js`, `${resolved}.jsx`, `${resolved}.json`, `${resolved}/index.ts`, `${resolved}/index.tsx`, `${resolved}/index.js`, `${resolved}/index.jsx`];
      if (!candidates.some((candidate) => paths.has(candidate))) broken.push(`${file.path} -> ${match[1]}`);
    }
  }
  return [...new Set(broken)];
}

function resolveRelative(fromPath: string, specifier: string) {
  const parts = normalizePath(fromPath).split("/").slice(0, -1);
  for (const part of specifier.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop(); else parts.push(part);
  }
  return normalizePath(parts.join("/"));
}

function normalizePath(path: string) { const value = String(path || "").replace(/\\/g, "/").replace(/\/{2,}/g, "/"); return value.startsWith("/") ? value : `/${value}`; }
function hasAny(paths: string[], candidates: string[]) { return candidates.some((path) => paths.includes(path)); }
function clamp(value: number) { return Math.max(0, Math.min(100, Math.round(value))); }
