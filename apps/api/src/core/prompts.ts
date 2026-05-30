import type { VirtualFile } from "./types";

export const AUTONOMOUS_PHASES = [

"product_spec",

"architecture",

"core_features",

"gameplay_or_business_logic",

"retention_systems",

"monetization_systems",

"ui_system",

"sprites_and_assets",

"animations_and_feedback",

"repair",

"final_packaging",

"final_audit",

"done",

];

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

const projectKind = detectProjectKind(prompt, target);

const repo = extractPromptValue(prompt, "github repo");

const branch = extractPromptValue(prompt, "github branch") || "main";

const infinite = /auto\s*improve\s*forever\s*:\s*true/i.test(prompt);

return [

"You are AutoApp autonomous project builder.",

"Return ONLY valid JSON. No markdown. No prose outside JSON.",

"",

"Required JSON shape:",

JSON.stringify(

{

files: [

{

path: "/src/App.tsx",

content: "complete file content",

},

],

changelog: "what changed and why",

estimatedTimeSaved: "practical estimate",

notes: ["short implementation note"],

},

null,

2

),

"",

"GLOBAL USER REQUEST:",

prompt,

"",

"PROJECT CONTEXT:",

JSON.stringify(

{

target,

projectKind,

phase,

strategy: strategy || "normal",

score,

build,

fileCount: files.length,

github: {

repo: repo || null,

branch,

},

infinite,

},

null,

2

),

"",

buildGlobalRules({ projectKind, infinite }),

"",

buildPhaseRules({ phase, projectKind, strategy: strategy || "normal" }),

"",

buildQualityBar({ projectKind }),

"",

buildAntiRegressionRules(),

"",

buildOutputRules(),

].join("\n");

}

function buildGlobalRules({

projectKind,

infinite,

}: {

projectKind: string;

infinite: boolean;

}) {

return [

"GLOBAL RULES:",

"- Preserve all useful existing systems.",

"- Never replace a working project with a simpler placeholder.",

"- Never remove important features unless directly fixing a bug.",

"- Every change must increase production readiness, gameplay quality, UX quality, or reliability.",

"- Keep imports, exports, file paths, package.json, and TypeScript valid.",

"- Avoid fake claims. If a real external provider is needed, create a real integration boundary or honest setup guide.",

"- Prefer small robust improvements over destructive rewrites.",

"- Return complete changed files only.",

"- If creating a new file, include the complete file.",

"- If modifying an existing file, include the complete file.",

"- Do not output partial patches.",

projectKind === "android-game"

? "- This is an Android-first mobile game. Prioritize portrait mode, one-touch gameplay, performance, retention, and Capacitor readiness."

: "- Prioritize mobile-first production UX and reliable app architecture.",

infinite

? "- Infinite mode is enabled: keep evolving the project across cycles without stopping at a fixed score."

: "- Finite mode: improve until production-ready and then finalize.",

].join("\n");

}

function buildPhaseRules({

phase,

projectKind,

strategy,

}: {

phase: string;

projectKind: string;

strategy: string;

}) {

const shared = [

`CURRENT PHASE: ${phase}`,

`CURRENT STRATEGY: ${strategy}`,

"PHASE OBJECTIVE:",

];

if (phase === "product_spec") {

return [

...shared,

"- Define or improve the real product direction.",

"- Add a strong README/product spec if missing.",

"- Clarify target user, core loop, value proposition, retention loop, and success criteria.",

"- For games, describe the 5-second understanding rule, one-more-run loop, progression, and monetization strategy.",

"- Avoid vague descriptions. Make the spec executable by future agents.",

].join("\n");

}

if (phase === "architecture") {

return [

...shared,

"- Create or improve a scalable project architecture.",

"- Ensure the file structure is logical, maintainable, and buildable.",

"- Add reusable modules for state, game logic, storage, UI, progression, and configuration.",

"- Ensure package.json scripts and dependencies match the generated code.",

"- Avoid unnecessary complexity.",

].join("\n");

}

if (phase === "core_features") {

return [

...shared,

"- Implement real core features, not static mockups.",

"- Add working state, actions, persistence, and user flows.",

"- For apps, implement the main workflows end-to-end.",

"- For games, implement the main play loop, scoring, progression and session state.",

"- Include empty/loading/error states where relevant.",

].join("\n");

}

if (phase === "gameplay_or_business_logic") {

return [

...shared,

"- Implement or deepen the real gameplay/business logic.",

projectKind === "android-game"

? "- Add or improve one-touch gameplay, procedural challenge, difficulty scaling, combos, upgrades, character/items, run results, rewards, and local save."

: "- Add or improve real domain logic, data flow, state transitions, validation, and persistence.",

"- Make systems reusable and testable by structure.",

"- Avoid decorative-only changes.",

].join("\n");

}

if (phase === "retention_systems") {

return [

...shared,

"- Improve retention and long-term engagement.",

"- Add or improve daily rewards, missions, streaks, achievements, unlock paths, onboarding, session goals, and progression pacing.",

"- Keep the systems ethical and non-pay-to-win.",

"- Make rewards visible and satisfying.",

"- Persist relevant progression locally.",

].join("\n");

}

if (phase === "monetization_systems") {

return [

...shared,

"- Add realistic monetization hooks without pretending real SDK credentials exist.",

"- Prefer rewarded ads hooks, cosmetic unlocks, battle-pass style data structures, and fair economy balancing.",

"- Do not hardcode secrets or fake real ad revenue.",

"- Create integration-ready boundaries and documented configuration points.",

"- Keep gameplay fair without pay-to-win.",

].join("\n");

}

if (phase === "ui_system") {

return [

...shared,

"- Improve mobile-first UI and visual hierarchy.",

"- Use clear navigation, large tap targets, responsive cards, readable typography, and premium spacing.",

"- Add polished HUD/dashboard/screens where relevant.",

"- Reduce visual clutter.",

"- Ensure the app is usable on narrow Android screens.",

].join("\n");

}

if (phase === "sprites_and_assets") {

return [

...shared,

"- Add lightweight local asset structure and SVG/CSS assets where useful.",

"- For games, create consistent visual identity, icons, particles, effects, characters/items placeholders that are visually polished and not empty.",

"- Keep assets lightweight and build-safe.",

"- Do not reference missing external assets.",

].join("\n");

}

if (phase === "animations_and_feedback") {

return [

...shared,

"- Add tactile feedback, animations, transitions, particles, combo feedback, reward feedback, and clear interaction states.",

"- Keep animations performant.",

"- Prefer CSS/React-friendly animations.",

"- For games, make hits, rewards, level-ups, and session results satisfying.",

].join("\n");

}

if (phase === "repair") {

return [

...shared,

"- Repair build, imports, exports, package.json, invalid JSX/TS, missing files, and inconsistent paths.",

"- Prefer minimal fixes.",

"- Do not rewrite the product unless unavoidable.",

"- Preserve working features.",

"- If there are build errors, fix those first.",

].join("\n");

}

if (phase === "final_packaging") {

return [

...shared,

"- Prepare deployment and release files.",

"- Add or improve README, Android build guide, manifest, metadata, icons, package scripts, and production checklist.",

"- Be honest about what must be built outside Cloudflare Worker.",

"- Ensure GitHub/Vercel/Cloudflare deployment readiness.",

].join("\n");

}

if (phase === "final_audit") {

return [

...shared,

"- Audit project completeness, quality, buildability, and product readiness.",

"- Fix small issues only.",

"- Improve documentation and clear next steps.",

"- Avoid large risky rewrites.",

].join("\n");

}

return [

...shared,

"- Improve the most important weakness currently visible in the project.",

"- Preserve buildability and existing useful features.",

].join("\n");

}

function buildQualityBar({ projectKind }: { projectKind: string }) {

if (projectKind === "android-game") {

return [

"ANDROID GAME QUALITY BAR:",

"- The game must be playable, not just described.",

"- It must have a clear one-touch core loop.",

"- It must include progression, upgrades, rewards, and replay motivation.",

"- It must have a mobile portrait layout.",

"- It must persist useful player progress locally.",

"- It must include performance-minded architecture.",

"- It must include Capacitor/Android readiness if packaging phase has run.",

"- It must feel like a credible indie mobile game prototype moving toward release.",

].join("\n");

}

return [

"APP QUALITY BAR:",

"- The app must have real user flows.",

"- It must be mobile-first and responsive.",

"- It must persist important data when relevant.",

"- It must include clear empty/loading/error states.",

"- It must be deployable and maintainable.",

].join("\n");

}

function buildAntiRegressionRules() {

return [

"ANTI-REGRESSION RULES:",

"- Compare current files mentally before returning changes.",

"- Do not delete systems that increase score unless replacing with a strictly better version.",

"- Do not downgrade UI density, mobile usability, or production readiness.",

"- Do not replace complex working logic with static placeholder arrays.",

"- Do not remove GitHub export instructions, Android readiness, persistence, or progression systems if present.",

"- Prefer adding focused modules over making one huge unreadable file.",

].join("\n");

}

function buildOutputRules() {

return [

"OUTPUT RULES:",

"- Return valid JSON only.",

"- The JSON must be parseable with JSON.parse.",

"- No markdown fences.",

"- No comments outside JSON.",

"- Each file path must start with /.",

"- File content must be a complete string.",

"- To delete a file, return { path, content: null }.",

"- Avoid excessive number of files in one cycle unless necessary.",

].join("\n");

}

function detectProjectKind(prompt: string, target: string) {

const text = `${prompt} ${target}`.toLowerCase();

if (

text.includes("android") &&

(text.includes("game") ||

text.includes("gameplay") ||

text.includes("viral mobile game"))

) {

return "android-game";

}

if (text.includes("game")) return "web-game";

if (text.includes("android")) return "android-app";

if (text.includes("saas")) return "saas-app";

return "web-app";

}

function extractPromptValue(prompt: string, key: string) {

const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const match = String(prompt).match(new RegExp(`${escaped}\\s*:\\s*(.+)`, "i"));

return match?.[1]?.trim() || "";

  }
