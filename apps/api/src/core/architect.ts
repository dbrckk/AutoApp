import type { VirtualFile } from "./types";
import type { ProductPlan } from "./planner";

export type ArchitecturePlan = {
  stack: string[];
  folders: string[];
  requiredFiles: string[];
  componentMap: ArchitectureComponent[];
  stateStrategy: string;
  routingStrategy: string;
  persistenceStrategy: string;
  integrationNotes: string[];
};

export type ArchitectureComponent = {
  name: string;
  path: string;
  purpose: string;
  priority: "critical" | "high" | "medium" | "low";
};

export function createArchitecturePlan(input: {
  plan: ProductPlan;
  files?: VirtualFile[];
}): ArchitecturePlan {
  const category = input.plan.category;

  return {
    stack: ["React", "TypeScript", "Vite", "CSS", "localStorage"],
    folders: ["/src", "/src/components", "/src/lib", "/src/hooks", "/src/data"],
    requiredFiles: ["/package.json", "/index.html", "/src/main.tsx", "/src/App.tsx", "/src/index.css"],
    componentMap: createComponentMap(category),
    stateStrategy: "Use React state for UI, localStorage for persistence, and isolated helper modules for data transformations.",
    routingStrategy: "Use internal tab state unless the project already includes a router.",
    persistenceStrategy: "Persist user settings, progress, workspace state and recent actions in localStorage with safe parsing.",
    integrationNotes: [
      "Keep every generated file complete.",
      "Avoid adding dependencies unless package.json is updated.",
      "Prefer resilient UI over complex architecture.",
      "Protect mobile layout and build stability.",
    ],
  };
}

export function architecturePlanToPrompt(plan: ArchitecturePlan) {
  return [
    "ARCHITECTURE PLAN",
    "Stack: " + plan.stack.join(", "),
    "",
    "Folders:",
    ...plan.folders.map((folder) => "- " + folder),
    "",
    "Required files:",
    ...plan.requiredFiles.map((file) => "- " + file),
    "",
    "Components:",
    ...plan.componentMap.map(
      (component) => "- [" + component.priority + "] " + component.path + ": " + component.purpose
    ),
    "",
    "State: " + plan.stateStrategy,
    "Routing: " + plan.routingStrategy,
    "Persistence: " + plan.persistenceStrategy,
    "",
    "Integration notes:",
    ...plan.integrationNotes.map((note) => "- " + note),
  ].join("\n");
}

export function getMissingRequiredFiles(input: {
  architecture: ArchitecturePlan;
  files: VirtualFile[];
}) {
  const paths = new Set(input.files.map((file) => file.path));
  return input.architecture.requiredFiles.filter((path) => !paths.has(path));
}

function createComponentMap(category: string): ArchitectureComponent[] {
  const common: ArchitectureComponent[] = [
    { name: "App", path: "/src/App.tsx", purpose: "Main product shell, navigation and screen composition.", priority: "critical" },
    { name: "EmptyState", path: "/src/components/EmptyState.tsx", purpose: "Reusable empty and error state presentation.", priority: "high" },
    { name: "Storage", path: "/src/lib/storage.ts", purpose: "Safe localStorage helpers.", priority: "high" },
  ];

  if (category === "mobile-game") {
    return [
      ...common,
      { name: "GameCanvas", path: "/src/components/GameCanvas.tsx", purpose: "Playable game loop and input surface.", priority: "critical" },
      { name: "UpgradePanel", path: "/src/components/UpgradePanel.tsx", purpose: "Progression and reward spending.", priority: "high" },
      { name: "MissionPanel", path: "/src/components/MissionPanel.tsx", purpose: "Daily missions and retention goals.", priority: "high" },
    ];
  }

  if (category === "saas-dashboard") {
    return [
      ...common,
      { name: "Dashboard", path: "/src/components/Dashboard.tsx", purpose: "Metrics, insights and primary operational actions.", priority: "critical" },
      { name: "Onboarding", path: "/src/components/Onboarding.tsx", purpose: "First-run product setup and value explanation.", priority: "high" },
      { name: "SettingsPanel", path: "/src/components/SettingsPanel.tsx", purpose: "Preference and configuration management.", priority: "medium" },
    ];
  }

  return common;
}
