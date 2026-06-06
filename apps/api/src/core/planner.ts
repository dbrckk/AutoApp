import type { VirtualFile } from "./types";

export type ProductPlan = {
  productName: string;
  category: string;
  audience: string;
  corePromise: string;
  screens: ProductScreen[];
  features: ProductFeature[];
  dataModels: ProductDataModel[];
  userFlows: ProductFlow[];
  releaseGoals: string[];
  risks: string[];
};

export type ProductScreen = {
  id: string;
  title: string;
  purpose: string;
  priority: "critical" | "high" | "medium" | "low";
};

export type ProductFeature = {
  id: string;
  title: string;
  description: string;
  priority: "critical" | "high" | "medium" | "low";
};

export type ProductDataModel = {
  name: string;
  fields: string[];
};

export type ProductFlow = {
  name: string;
  steps: string[];
};

export function createProductPlan(input: {
  prompt: string;
  files?: VirtualFile[];
}): ProductPlan {
  const prompt = String(input.prompt || "").trim();
  const lower = prompt.toLowerCase();
  const category = detectCategory(lower);

  return {
    productName: detectProductName(prompt, category),
    category,
    audience: detectAudience(lower),
    corePromise: createCorePromise(category),
    screens: createScreens(category),
    features: createFeatures(category),
    dataModels: createDataModels(category),
    userFlows: createUserFlows(category),
    releaseGoals: createReleaseGoals(category),
    risks: createRisks(category),
  };
}

export function productPlanToPrompt(plan: ProductPlan) {
  return [
    "PRODUCT PLAN",
    "Name: " + plan.productName,
    "Category: " + plan.category,
    "Audience: " + plan.audience,
    "Core promise: " + plan.corePromise,
    "",
    "Screens:",
    ...plan.screens.map(
      (screen) => "- [" + screen.priority + "] " + screen.title + ": " + screen.purpose
    ),
    "",
    "Features:",
    ...plan.features.map(
      (feature) => "- [" + feature.priority + "] " + feature.title + ": " + feature.description
    ),
    "",
    "Data models:",
    ...plan.dataModels.map((model) => "- " + model.name + ": " + model.fields.join(", ")),
    "",
    "User flows:",
    ...plan.userFlows.map((flow) => "- " + flow.name + ": " + flow.steps.join(" -> ")),
    "",
    "Release goals:",
    ...plan.releaseGoals.map((goal) => "- " + goal),
    "",
    "Risks:",
    ...plan.risks.map((risk) => "- " + risk),
  ].join("\n");
}

function detectCategory(prompt: string) {
  if (prompt.includes("game") || prompt.includes("android") || prompt.includes("tiktok")) return "mobile-game";
  if (prompt.includes("saas") || prompt.includes("dashboard") || prompt.includes("analytics")) return "saas-dashboard";
  if (prompt.includes("marketplace")) return "marketplace";
  if (prompt.includes("trading")) return "trading-tool";
  if (prompt.includes("crypto") || prompt.includes("token")) return "crypto-app";
  if (prompt.includes("landing")) return "landing-page";
  return "web-application";
}

function detectProductName(prompt: string, category: string) {
  const explicit = prompt.match(/(?:name|called|title)\s*:\s*([a-z0-9 _-]{3,40})/i);

  if (explicit?.[1]) return toTitle(explicit[1]);

  const defaults: Record<string, string> = {
    "mobile-game": "Viral Arcade",
    "saas-dashboard": "Creator Command",
    marketplace: "MarketOS",
    "trading-tool": "Signal Desk",
    "crypto-app": "Token Studio",
    "landing-page": "Launch Page",
    "web-application": "AutoApp Product",
  };

  return defaults[category] || "AutoApp Product";
}

function detectAudience(prompt: string) {
  if (prompt.includes("creator")) return "content creators and solo founders";
  if (prompt.includes("business")) return "small businesses and operators";
  if (prompt.includes("game")) return "mobile players seeking fast replayable sessions";
  if (prompt.includes("developer")) return "developers and technical builders";
  return "mobile-first users who need a polished product experience";
}

function createCorePromise(category: string) {
  const map: Record<string, string> = {
    "mobile-game": "A replayable polished mobile experience with clear progression and fast engagement loops.",
    "saas-dashboard": "A premium operational dashboard that turns complex work into simple daily decisions.",
    marketplace: "A trustworthy marketplace experience with discovery, listings, filtering and conversion flows.",
    "trading-tool": "A focused signal workspace for tracking markets, alerts and decisions.",
    "crypto-app": "A clear token product interface with wallet-safe UX and transparent user flows.",
    "landing-page": "A conversion-focused launch page with strong messaging and clear calls to action.",
    "web-application": "A complete polished web product with clear navigation and useful workflows.",
  };

  return map[category] || map["web-application"];
}

function createScreens(category: string): ProductScreen[] {
  const base: ProductScreen[] = [
    { id: "onboarding", title: "Onboarding", purpose: "Explain value and guide first action.", priority: "critical" },
    { id: "dashboard", title: "Dashboard", purpose: "Show state, progress, actions and metrics.", priority: "critical" },
    { id: "settings", title: "Settings", purpose: "Configure preferences and product behavior.", priority: "high" },
  ];

  if (category === "mobile-game") {
    return [
      { id: "start", title: "Start Screen", purpose: "Launch the game and show progression.", priority: "critical" },
      { id: "gameplay", title: "Gameplay", purpose: "Deliver the playable loop with score and feedback.", priority: "critical" },
      { id: "upgrades", title: "Upgrades", purpose: "Convert earned score into progression.", priority: "high" },
      { id: "missions", title: "Missions", purpose: "Drive retention with goals.", priority: "high" },
    ];
  }

  if (category === "saas-dashboard") {
    return [
      ...base,
      { id: "analytics", title: "Analytics", purpose: "Reveal trends and actionable insights.", priority: "critical" },
      { id: "projects", title: "Projects", purpose: "Manage workspaces or campaigns.", priority: "high" },
      { id: "exports", title: "Exports", purpose: "Export reports or assets.", priority: "medium" },
    ];
  }

  return base;
}

function createFeatures(category: string): ProductFeature[] {
  const base: ProductFeature[] = [
    { id: "responsive-layout", title: "Responsive layout", description: "Works cleanly on mobile, tablet and desktop.", priority: "critical" },
    { id: "state-handling", title: "State handling", description: "Includes loading, empty and error states.", priority: "critical" },
    { id: "local-persistence", title: "Local persistence", description: "Saves important user state locally.", priority: "high" },
  ];

  if (category === "mobile-game") {
    return [
      ...base,
      { id: "game-loop", title: "Playable loop", description: "Input, scoring, feedback and replay.", priority: "critical" },
      { id: "progression", title: "Progression", description: "Levels, upgrades, currency or unlocks.", priority: "critical" },
      { id: "retention", title: "Retention hooks", description: "Missions, streaks or daily rewards.", priority: "high" },
    ];
  }

  if (category === "saas-dashboard") {
    return [
      ...base,
      { id: "analytics", title: "Analytics cards", description: "Clear metrics, trends and status indicators.", priority: "critical" },
      { id: "workflow", title: "Primary workflow", description: "Complete path from input to useful output.", priority: "critical" },
      { id: "export", title: "Export workflow", description: "Save, copy or download product output.", priority: "high" },
    ];
  }

  return base;
}

function createDataModels(category: string): ProductDataModel[] {
  if (category === "mobile-game") {
    return [
      { name: "PlayerProfile", fields: ["level", "xp", "coins", "bestScore"] },
      { name: "Mission", fields: ["id", "title", "goal", "reward", "completed"] },
      { name: "Upgrade", fields: ["id", "name", "level", "cost", "effect"] },
    ];
  }

  if (category === "saas-dashboard") {
    return [
      { name: "Workspace", fields: ["id", "name", "createdAt", "status"] },
      { name: "Metric", fields: ["id", "label", "value", "trend"] },
      { name: "Report", fields: ["id", "title", "createdAt", "items"] },
    ];
  }

  return [
    { name: "UserProfile", fields: ["id", "name", "preferences"] },
    { name: "Item", fields: ["id", "title", "status", "createdAt"] },
  ];
}

function createUserFlows(category: string): ProductFlow[] {
  if (category === "mobile-game") {
    return [
      { name: "First session", steps: ["open app", "start game", "play", "score", "upgrade", "replay"] },
      { name: "Retention loop", steps: ["open missions", "complete goal", "claim reward", "unlock upgrade"] },
    ];
  }

  return [
    { name: "First value", steps: ["open app", "complete onboarding", "enter data", "view dashboard", "export result"] },
    { name: "Daily use", steps: ["open dashboard", "review metrics", "take action", "save progress"] },
  ];
}

function createReleaseGoals(category: string) {
  const goals = [
    "Build succeeds without missing imports.",
    "Mobile layout is usable below 390px width.",
    "No placeholder-only screen.",
    "Primary action is visible above the fold.",
  ];

  if (category === "mobile-game") goals.push("Game loop is playable without external services.");

  return goals;
}

function createRisks(category: string) {
  const risks = [
    "Generic placeholder UI.",
    "Missing responsive behavior.",
    "No error handling.",
    "No persistent state.",
    "Unclear primary action.",
  ];

  if (category === "mobile-game") risks.push("Decorative game without real interaction.");

  return risks;
}

function toTitle(value: string) {
  return value
    .trim()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
    }
    
