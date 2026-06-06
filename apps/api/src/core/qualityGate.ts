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

export function runQualityGate(files: VirtualFile[]): QualityGateResult {
  const paths = files.map((file) => file.path);
  const allContent = files.map((file) => file.content || "").join("\n");

  const categories = {
    buildability: scoreBuildability(paths, allContent),
    structure: scoreStructure(paths),
    uiUx: scoreUiUx(allContent),
    mobile: scoreMobile(allContent),
    resilience: scoreResilience(allContent),
    productDepth: scoreProductDepth(allContent),
  };

  const blockers = createBlockers(paths, allContent);
  const warnings = createWarnings(paths, allContent);
  const suggestions = createSuggestions(categories, warnings);

  const total = Math.round(
    categories.buildability * 0.24 +
      categories.structure * 0.16 +
      categories.uiUx * 0.18 +
      categories.mobile * 0.14 +
      categories.resilience * 0.12 +
      categories.productDepth * 0.16
  );

  return {
    total,
    passed: total >= 75 && blockers.length === 0,
    categories,
    blockers,
    warnings,
    suggestions,
  };
}

export function qualityGateToPrompt(result: QualityGateResult) {
  return [
    "QUALITY GATE",
    "Total: " + result.total + "/100",
    "Passed: " + (result.passed ? "yes" : "no"),
    "",
    "Categories:",
    ...Object.entries(result.categories).map(([key, value]) => "- " + key + ": " + value + "/100"),
    "",
    "Blockers:",
    ...(result.blockers.length ? result.blockers.map((item) => "- " + item) : ["- none"]),
    "",
    "Warnings:",
    ...(result.warnings.length ? result.warnings.map((item) => "- " + item) : ["- none"]),
    "",
    "Suggestions:",
    ...(result.suggestions.length ? result.suggestions.map((item) => "- " + item) : ["- none"]),
  ].join("\n");
}

function scoreBuildability(paths: string[], content: string) {
  let score = 0;
  if (paths.includes("/package.json")) score += 20;
  if (paths.includes("/index.html")) score += 15;
  if (paths.includes("/src/main.tsx") || paths.includes("/src/main.jsx")) score += 20;
  if (paths.includes("/src/App.tsx") || paths.includes("/src/App.jsx")) score += 20;
  if (!/TODO|not implemented/i.test(content)) score += 15;
  if (!/from\s+["'][^"']*undefined/i.test(content)) score += 10;
  return clamp(score);
}

function scoreStructure(paths: string[]) {
  let score = 0;
  if (paths.some((path) => path.includes("/components/"))) score += 25;
  if (paths.some((path) => path.includes("/lib/"))) score += 20;
  if (paths.some((path) => path.includes("/hooks/"))) score += 15;
  if (paths.length >= 6) score += 15;
  if (paths.length >= 10) score += 15;
  if (paths.some((path) => path.endsWith(".css"))) score += 10;
  return clamp(score);
}

function scoreUiUx(content: string) {
  let score = 0;
  if (/empty|loading|error/i.test(content)) score += 20;
  if (/dashboard|settings|onboarding|analytics/i.test(content)) score += 25;
  if (/rounded|shadow|gradient|grid|flex/i.test(content)) score += 20;
  if (/button|input|textarea|select/i.test(content)) score += 15;
  if (/aria-|role=|label/i.test(content)) score += 10;
  if (/hover:|focus:/i.test(content)) score += 10;
  return clamp(score);
}

function scoreMobile(content: string) {
  let score = 0;
  if (/sm:|md:|lg:|xl:/i.test(content)) score += 25;
  if (/min-h-screen|min-h-\[|100dvh/i.test(content)) score += 15;
  if (/overflow-x-hidden|w-full|min-w-0/i.test(content)) score += 20;
  if (/grid|flex|wrap/i.test(content)) score += 15;
  if (/safe-area|env\(safe-area/i.test(content)) score += 10;
  if (/mobile|bottom|fixed/i.test(content)) score += 15;
  return clamp(score);
}

function scoreResilience(content: string) {
  let score = 0;
  if (/try\s*{|catch\s*\(/i.test(content)) score += 20;
  if (/loading|busy|disabled/i.test(content)) score += 20;
  if (/error|failed|fallback/i.test(content)) score += 20;
  if (/localStorage|safe/i.test(content)) score += 15;
  if (/Array\.isArray|\|\|\s*\[\]/i.test(content)) score += 15;
  if (/\?\./i.test(content)) score += 10;
  return clamp(score);
}

function scoreProductDepth(content: string) {
  let score = 0;
  if (/onboarding/i.test(content)) score += 15;
  if (/dashboard/i.test(content)) score += 15;
  if (/analytics|metric|chart|score/i.test(content)) score += 15;
  if (/settings|preferences/i.test(content)) score += 15;
  if (/export|download|copy/i.test(content)) score += 15;
  if (/history|timeline|activity/i.test(content)) score += 15;
  if (/mission|progress|upgrade|level|streak/i.test(content)) score += 10;
  return clamp(score);
}

function createBlockers(paths: string[], content: string) {
  const blockers: string[] = [];
  if (!paths.includes("/package.json")) blockers.push("Missing package.json.");
  if (!paths.includes("/index.html")) blockers.push("Missing index.html.");
  if (!paths.includes("/src/main.tsx") && !paths.includes("/src/main.jsx")) blockers.push("Missing React entry file.");
  if (!paths.includes("/src/App.tsx") && !paths.includes("/src/App.jsx")) blockers.push("Missing App component.");
  if (/placeholder-only|lorem ipsum/i.test(content)) blockers.push("Placeholder-only content detected.");
  return blockers;
}

function createWarnings(paths: string[], content: string) {
  const warnings: string[] = [];
  if (!paths.some((path) => path.includes("/components/"))) warnings.push("No component folder detected.");
  if (!/empty|loading|error/i.test(content)) warnings.push("Missing visible empty/loading/error states.");
  if (!/localStorage|indexedDB/i.test(content)) warnings.push("No persistence detected.");
  if (!/sm:|md:|lg:|@media/i.test(content)) warnings.push("Responsive behavior is weak or not visible.");
  return warnings;
}

function createSuggestions(categories: QualityGateResult["categories"], warnings: string[]) {
  const suggestions: string[] = [];
  if (categories.uiUx < 75) suggestions.push("Improve visual hierarchy, empty states, and primary actions.");
  if (categories.mobile < 75) suggestions.push("Strengthen mobile-first layout and prevent horizontal scroll.");
  if (categories.productDepth < 75) suggestions.push("Add complete workflows instead of isolated screens.");
  if (categories.resilience < 75) suggestions.push("Add error, loading, and safe persistence handling.");
  suggestions.push(...warnings);
  return Array.from(new Set(suggestions)).slice(0, 10);
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}
