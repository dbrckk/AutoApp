import type { VirtualFile } from "./types";

export type ProductMemory = {
  vision: string;
  productType: string;
  targetUsers: string;
  doNotRemove: string[];
  strengths: string[];
  weaknesses: string[];
  knownBugs: string[];
  decisions: ProductDecision[];
  changelog: ProductChange[];
  lastUpdated: number;
};

export type ProductDecision = {
  at: number;
  type: "keep" | "improve" | "replace" | "delete" | "skip";
  target: string;
  reason: string;
  expectedImpact: number;
};

export type ProductChange = {
  at: number;
  title: string;
  category: string;
  impact: number;
};

export function createInitialProductMemory(input: {
  prompt: string;
  files?: VirtualFile[];
}): ProductMemory {
  const prompt = String(input.prompt || "");
  const lower = prompt.toLowerCase();

  return {
    vision: detectVision(prompt),
    productType: detectProductType(lower),
    targetUsers: detectTargetUsers(lower),
    doNotRemove: detectProtectedElements(lower),
    strengths: detectStrengths(input.files || []),
    weaknesses: detectWeaknesses(input.files || []),
    knownBugs: [],
    decisions: [],
    changelog: [],
    lastUpdated: Date.now(),
  };
}

export function updateProductMemory(input: {
  memory?: ProductMemory | null;
  prompt: string;
  files: VirtualFile[];
  decision?: ProductDecision;
  change?: ProductChange;
}) {
  const memory =
    input.memory ||
    createInitialProductMemory({
      prompt: input.prompt,
      files: input.files,
    });

  const next: ProductMemory = {
    ...memory,
    strengths: mergeUnique(memory.strengths, detectStrengths(input.files)),
    weaknesses: mergeUnique(memory.weaknesses, detectWeaknesses(input.files)),
    decisions: input.decision
      ? [input.decision, ...memory.decisions].slice(0, 80)
      : memory.decisions,
    changelog: input.change
      ? [input.change, ...memory.changelog].slice(0, 120)
      : memory.changelog,
    lastUpdated: Date.now(),
  };

  return next;
}

export function productMemoryToPrompt(memory: ProductMemory) {
  return [
    "PRODUCT MEMORY",
    "Vision: " + memory.vision,
    "Type: " + memory.productType,
    "Target users: " + memory.targetUsers,
    "",
    "Do not remove:",
    ...(memory.doNotRemove.length ? memory.doNotRemove : ["none"]).map(
      (item) => "- " + item
    ),
    "",
    "Strengths:",
    ...(memory.strengths.length ? memory.strengths : ["none"]).map(
      (item) => "- " + item
    ),
    "",
    "Weaknesses:",
    ...(memory.weaknesses.length ? memory.weaknesses : ["none"]).map(
      (item) => "- " + item
    ),
    "",
    "Known bugs:",
    ...(memory.knownBugs.length ? memory.knownBugs : ["none"]).map(
      (item) => "- " + item
    ),
    "",
    "Recent decisions:",
    ...memory.decisions.slice(0, 10).map(
      (decision) =>
        "- " +
        decision.type +
        " " +
        decision.target +
        ": " +
        decision.reason +
        " impact " +
        decision.expectedImpact
    ),
    "",
    "Recent changes:",
    ...memory.changelog.slice(0, 10).map(
      (change) =>
        "- " +
        change.title +
        " [" +
        change.category +
        "] impact " +
        change.impact
    ),
  ].join("\n");
}

function detectVision(prompt: string) {
  const trimmed = prompt.trim();

  if (!trimmed) return "Build a polished autonomous software product.";

  return trimmed.split("\n")[0].slice(0, 180);
}

function detectProductType(prompt: string) {
  if (prompt.includes("game")) return "game";
  if (prompt.includes("saas") || prompt.includes("dashboard")) return "saas";
  if (prompt.includes("marketplace")) return "marketplace";
  if (prompt.includes("trading")) return "trading";
  if (prompt.includes("crypto")) return "crypto";
  return "web-app";
}

function detectTargetUsers(prompt: string) {
  if (prompt.includes("creator")) return "creators and solo founders";
  if (prompt.includes("business")) return "small businesses";
  if (prompt.includes("game")) return "mobile players";
  if (prompt.includes("developer")) return "developers";
  return "mobile-first users";
}

function detectProtectedElements(prompt: string) {
  const items = ["build stability", "mobile layout", "primary user flow"];

  if (prompt.includes("auth")) items.push("auth");
  if (prompt.includes("dashboard")) items.push("dashboard");
  if (prompt.includes("billing")) items.push("billing");
  if (prompt.includes("game")) items.push("gameplay loop");

  return items;
}

function detectStrengths(files: VirtualFile[]) {
  const content = files.map((file) => file.content || "").join("\n");
  const paths = files.map((file) => file.path);
  const strengths: string[] = [];

  if (paths.includes("/src/App.tsx")) strengths.push("main app shell exists");
  if (paths.some((path) => path.includes("/components/"))) strengths.push("component structure exists");
  if (/localStorage|indexedDB/i.test(content)) strengths.push("persistence exists");
  if (/loading|error|empty/i.test(content)) strengths.push("state handling exists");
  if (/sm:|md:|lg:|@media/i.test(content)) strengths.push("responsive styling exists");

  return strengths;
}

function detectWeaknesses(files: VirtualFile[]) {
  const content = files.map((file) => file.content || "").join("\n");
  const paths = files.map((file) => file.path);
  const weaknesses: string[] = [];

  if (!paths.includes("/src/App.tsx")) weaknesses.push("missing main app shell");
  if (!paths.some((path) => path.includes("/components/"))) weaknesses.push("weak component structure");
  if (!/loading|error|empty/i.test(content)) weaknesses.push("missing state handling");
  if (!/localStorage|indexedDB/i.test(content)) weaknesses.push("missing persistence");
  if (/TODO|placeholder|lorem ipsum/i.test(content)) weaknesses.push("placeholder content remains");

  return weaknesses;
}

function mergeUnique(a: string[], b: string[]) {
  return Array.from(new Set([...(a || []), ...(b || [])])).slice(0, 30);
  }
