import type { VirtualFile } from "./types";
import { serializeFiles } from "./files";
import { getTargetProfile } from "./targets";

export const AUTONOMOUS_PHASES = [
  "product_spec",
  "architecture",
  "base_files",
  "ui_system",
  "core_features",
  "gameplay_or_business_logic",
  "sprites_and_assets",
  "animations_and_feedback",
  "virtual_build",
  "repair",
  "launch_pack",
  "final_packaging",
  "final_audit",
  "done",
];

export function buildExpertPrompt({
  userPrompt,
  files,
  build,
  score,
  target,
}: {
  userPrompt: string;
  files: VirtualFile[];
  build: any;
  score: any;
  target: string;
}) {
  return [
    "You are AutoApp, an expert autonomous app builder.",
    "Return ONLY valid JSON. No markdown.",
    "",
    "Required JSON shape:",
    JSON.stringify(
      {
        files: [
          { path: "/package.json", content: "complete file content" },
          { path: "/index.html", content: "complete file content" },
          { path: "/vite.config.ts", content: "complete file content" },
          { path: "/tsconfig.json", content: "complete file content" },
          { path: "/src/main.tsx", content: "complete file content" },
          { path: "/src/App.tsx", content: "complete file content" },
          { path: "/src/style.css", content: "complete file content" },
        ],
        changelog: "summary",
        estimatedTimeSaved: "estimate",
      },
      null,
      2
    ),
    "",
    "Rules:",
    "- Generate a complete usable product, not a demo.",
    "- Return complete changed files only.",
    "- Prefer React + Vite + TypeScript.",
    "- Keep npm install && npm run build valid.",
    "- Include mobile-first UI, states, interactions, and deployment readiness.",
    "- For games: include gameplay loop, score, controls, restart, progression.",
    "- For Android: include Capacitor readiness.",
    "- No TODO.",
    "- No placeholders unless sample data is intentionally used.",
    "- No broken imports.",
    "",
    "Target:",
    target,
    "",
    "Target profile:",
    JSON.stringify(getTargetProfile(target), null, 2),
    "",
    "User request:",
    userPrompt,
    "",
    "Current build:",
    JSON.stringify(build, null, 2),
    "",
    "Current score:",
    JSON.stringify(score, null, 2),
    "",
    "Current files:",
    serializeFiles(files),
  ].join("\n");
}

export function buildRepairPrompt({
  userPrompt,
  files,
  build,
  score,
}: {
  userPrompt: string;
  files: VirtualFile[];
  build: any;
  score: any;
}) {
  return [
    "You are AutoApp expert repair agent.",
    "Return ONLY valid JSON. No markdown.",
    "",
    "Required JSON shape:",
    JSON.stringify(
      {
        files: [{ path: "/src/App.tsx", content: "complete corrected file content" }],
        changelog: "repair summary",
        estimatedTimeSaved: "estimate",
      },
      null,
      2
    ),
    "",
    "Mission:",
    "- Fix root causes.",
    "- Fix all build/import/dependency/JSON issues.",
    "- Return complete changed files only.",
    "- Do not remove important features unless required.",
    "- If a dependency is required, update /package.json.",
    "- If an imported file is missing, create it or remove/fix the import.",
    "",
    "User request:",
    userPrompt,
    "",
    "Build issues:",
    JSON.stringify(build, null, 2),
    "",
    "Current score:",
    JSON.stringify(score, null, 2),
    "",
    "Files:",
    serializeFiles(files),
  ].join("\n");
}

export function buildPhasePrompt({
  phase,
  prompt,
  target,
  files,
  build,
  score,
  strategy,
}: {
  phase: string;
  prompt: string;
  target: string;
  files: VirtualFile[];
  build: any;
  score: any;
  strategy?: string;
}) {
  return [
    `You are AutoApp autonomous phase agent: ${phase}.`,
    "Return ONLY valid JSON. No markdown.",
    "",
    "Required JSON shape:",
    JSON.stringify(
      {
        files: [{ path: "/src/App.tsx", content: "complete file content" }],
        changelog: "phase summary",
        estimatedTimeSaved: "estimate",
      },
      null,
      2
    ),
    "",
    "Global goal:",
    "- Create a complete application autonomously from the user prompt.",
    "- The app must become a complete usable product.",
    "- Do not create a demo.",
    "- Do not stop at a landing page unless the target is explicitly landing-page.",
    "- Add real flows, state, data, screens and interactions.",
    "- Keep npm install && npm run build valid.",
    "",
    "User goal:",
    prompt,
    "",
    "Target:",
    target,
    "",
    "Target profile:",
    JSON.stringify(getTargetProfile(target), null, 2),
    "",
    "Current phase:",
    phase,
    "",
    "Phase instruction:",
    getPhaseInstruction(phase, target),
    "",
    "Current strategy:",
    strategy || "normal",
    "",
    "Strategy instruction:",
    getStrategyInstruction(strategy || "normal"),
    "",
    "Current build:",
    JSON.stringify(build, null, 2),
    "",
    "Current score:",
    JSON.stringify(score, null, 2),
    "",
    "Current files:",
    serializeFiles(files),
  ].join("\n");
}

export function getPhaseInstruction(phase: string, target: string) {
  const map: Record<string, string> = {
    product_spec:
      "Create or improve README.md with product spec, target user, core loop, screens, features, success criteria and deployment target.",

    architecture:
      "Create stable Vite/React architecture. Add base files if missing. Plan reusable components but avoid broken imports.",

    base_files:
      "Create package.json, index.html, vite.config.ts, tsconfig.json, src/main.tsx, src/App.tsx and src/style.css if missing.",

    ui_system:
      "Create premium mobile-first UI, navigation, cards, panels, status badges, responsive layout and accessible controls.",

    core_features:
      "Implement the main product features, real state, data models, user actions, settings, history and export/import when relevant.",

    gameplay_or_business_logic:
      target.includes("game")
        ? "Implement addictive gameplay loop: start, play, score, progression, difficulty, game over, restart, mobile controls."
        : "Implement core business logic, workflows, project states, scoring, automation and user actions.",

    sprites_and_assets:
      target.includes("game")
        ? "Create high-quality local game assets as SVG sprites, CSS effects, sprite manifest, canvas drawing helpers, particle styles, hit effects, collectible icons, enemy/player visuals and background layers. Do not use external images."
        : "Create local visual assets as SVG, CSS backgrounds, icons, empty-state illustrations, product mockups or decorative interface elements. Do not use external images.",

    animations_and_feedback:
      target.includes("game")
        ? "Add gameplay animations: spawn, hit, collect, score, combo, level-up, game-over transitions, touch feedback, particle effects and smooth CSS/canvas animations."
        : "Add polished animations, feedback states, transitions, loading/success/error states and micro-interactions.",

    virtual_build:
      "Fix virtual build issues and ensure all imports, dependencies and JSON files are valid.",

    repair:
      "Fix all build/import/dependency/JSON issues. Return only complete corrected files.",

    launch_pack:
      target.includes("android")
        ? "Add README, .env.example, Android build guide, Capacitor notes, manifest, app icons, Cloudflare Pages notes and APK/AAB build instructions."
        : "Add README, .env.example, robots.txt, deployment instructions and Cloudflare Pages notes.",

    final_packaging:
      "Create the final delivery package for the detected target: deployment files, README, env example, manifests, platform-specific instructions, asset manifest, release checklist and final user testing checklist.",

    final_audit:
      "Perform final quality pass. Improve weakest score categories. Avoid regressions.",

    done:
      "No changes needed.",
  };

  return map[phase] || "Improve the project.";
}

export function getStrategyInstruction(strategy: string) {
  const map: Record<string, string> = {
    force_product_depth:
      "Focus on deeper real product workflows, states, sample data, interactions and user value.",

    force_ui:
      "Focus on premium UI quality, hierarchy, spacing, cards, responsive layout and visual polish.",

    force_mobile:
      "Focus on mobile-first layout, touch ergonomics, breakpoints and overflow handling.",

    force_reliability:
      "Focus on loading, empty, error, fallback, disabled and recovery states.",

    force_seo:
      "Focus on SEO metadata, README, sitemap, robots and launch documentation.",

    force_assets:
      "Focus on stronger local SVG/CSS/canvas assets and game visual feedback.",

    force_feedback:
      "Focus on animation, feedback, transitions and interaction feel.",

    repair:
      "Focus only on fixing build/import/dependency/JSON issues.",

    finalize:
      "Focus on final packaging, release checklist, deployment instructions and readiness.",
  };

  return map[strategy] || "Normal improvement strategy.";
    }
