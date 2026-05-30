import type { VirtualFile } from "./types";

import { normalizePath } from "./files";

export type ScoreBreakdown = {

total: number;

architecture: number;

ui: number;

mobile: number;

reliability: number;

productDepth: number;

completeness: number;

productionReadiness: number;

gameplay: number;

retention: number;

monetization: number;

androidReady: number;

antiPlaceholder: number;

};

export function scoreProject(files: VirtualFile[]): ScoreBreakdown {

const normalized = normalizeFiles(files);

const text = normalized.map((file) => `${file.path}\n${file.content || ""}`).join("\n\n");

const lower = text.toLowerCase();

const paths = normalized.map((file) => normalizePath(file.path));

const architecture = scoreArchitecture(paths, lower);

const ui = scoreUi(lower, paths);

const mobile = scoreMobile(lower);

const reliability = scoreReliability(lower, paths);

const productDepth = scoreProductDepth(lower, paths);

const completeness = scoreCompleteness(paths, lower);

const productionReadiness = scoreProductionReadiness(paths, lower);

const gameplay = scoreGameplay(lower, paths);

const retention = scoreRetention(lower);

const monetization = scoreMonetization(lower);

const androidReady = scoreAndroidReady(paths, lower);

const antiPlaceholder = scoreAntiPlaceholder(lower);

const isGame = detectGame(lower, paths);

const isAndroid = detectAndroid(lower, paths);

const weights = isGame

? {

architecture: 0.1,

ui: 0.1,

mobile: isAndroid ? 0.12 : 0.09,

reliability: 0.12,

productDepth: 0.12,

completeness: 0.08,

productionReadiness: 0.08,

gameplay: 0.14,

retention: 0.08,

monetization: 0.03,

androidReady: isAndroid ? 0.08 : 0.02,

antiPlaceholder: 0.07,

}

: {

architecture: 0.14,

ui: 0.14,

mobile: 0.14,

reliability: 0.14,

productDepth: 0.12,

completeness: 0.12,

productionReadiness: 0.1,

gameplay: 0.01,

retention: 0.04,

monetization: 0.02,

androidReady: isAndroid ? 0.06 : 0.01,

antiPlaceholder: 0.07,

};

const total = clampScore(

Math.round(

architecture * weights.architecture +

ui * weights.ui +

mobile * weights.mobile +

reliability * weights.reliability +

productDepth * weights.productDepth +

completeness * weights.completeness +

productionReadiness * weights.productionReadiness +

gameplay * weights.gameplay +

retention * weights.retention +

monetization * weights.monetization +

androidReady * weights.androidReady +

antiPlaceholder * weights.antiPlaceholder

)

);

return {

total,

architecture,

ui,

mobile,

reliability,

productDepth,

completeness,

productionReadiness,

gameplay,

retention,

monetization,

androidReady,

antiPlaceholder,

};

}

export function buildNextActions(score: ScoreBreakdown, build: any) {

const actions: string[] = [];

if (!build?.ok) {

actions.push("Repair build errors and missing imports before adding features.");

}

if (score.reliability < 80) actions.push("Improve reliability, state handling, persistence, and error boundaries.");

if (score.productDepth < 80) actions.push("Add real product depth, workflows, progression, and useful systems.");

if (score.gameplay < 75) actions.push("Improve gameplay loop, scoring, controls, difficulty, and session feedback.");

if (score.retention < 75) actions.push("Add missions, daily rewards, streaks, achievements, and unlock paths.");

if (score.ui < 80) actions.push("Improve visual hierarchy, UI polish, spacing, and interaction feedback.");

if (score.mobile < 85) actions.push("Improve mobile-first layout, tap targets, portrait mode, and responsive behavior.");

if (score.androidReady < 75) actions.push("Add Android/Capacitor readiness files, manifest, icons, and Android build guide.");

if (score.monetization < 60) actions.push("Add fair rewarded-ad hooks, cosmetic progression, and non-pay-to-win monetization architecture.");

if (score.antiPlaceholder < 85) actions.push("Replace placeholder/demo-only code with real working systems.");

if (!actions.length) {

actions.push("Project is strong; focus on small polish, documentation, and release readiness.");

}

return actions;

}

function scoreArchitecture(paths: string[], lower: string) {

let score = 15;

if (paths.includes("/package.json")) score += 12;

if (paths.includes("/vite.config.ts") || paths.includes("/vite.config.js")) score += 8;

if (paths.includes("/src/main.tsx") || paths.includes("/src/main.jsx")) score += 8;

if (paths.includes("/src/App.tsx") || paths.includes("/src/App.jsx")) score += 8;

if (paths.some((path) => path.includes("/components/"))) score += 10;

if (paths.some((path) => path.includes("/lib/"))) score += 8;

if (paths.some((path) => path.includes("/hooks/"))) score += 8;

if (paths.some((path) => path.includes("/data/"))) score += 6;

if (paths.some((path) => path.includes("/systems/"))) score += 8;

if (paths.some((path) => path.includes("/game/"))) score += 8;

if (lower.includes("export function") || lower.includes("export const")) score += 5;

if (lower.includes("type ") || lower.includes("interface ")) score += 5;

return clampScore(score);

}

function scoreUi(lower: string, paths: string[]) {

let score = 10;

const uiTerms = ["classname", "button", "input", "card", "modal", "panel", "dashboard", "hud", "toast", "loading", "empty", "error", "disabled", "hover:", "active:", "transition", "rounded", "shadow", "gradient"];

score += countHits(lower, uiTerms) * 4;

if (paths.some((path) => path.toLowerCase().includes("components"))) score += 8;

if (paths.some((path) => path.toLowerCase().includes("style.css"))) score += 6;

if (lower.includes("tailwindcss")) score += 8;

return clampScore(score);

}

function scoreMobile(lower: string) {

let score = 10;

const mobileTerms = ["viewport", "mobile", "portrait", "bottom", "safe-area", "touch", "tap", "responsive", "min-h-screen", "grid", "flex", "sm:", "md:", "lg:", "max-w", "overflow-auto", "fixed bottom", "bottom-0"];

score += countHits(lower, mobileTerms) * 5;

if (lower.includes("user-select")) score += 4;

if (lower.includes("touch-action")) score += 6;

if (lower.includes("env(safe-area-inset")) score += 8;

return clampScore(score);

}

function scoreReliability(lower: string, paths: string[]) {

let score = 15;

const terms = ["try {", "catch", "fallback", "error", "loading", "disabled", "localstorage", "json.parse", "array.isarray", "typeof", "optional", "?.", "usememo", "usecallback"];

score += countHits(lower, terms) * 4;

if (paths.includes("/src/types.ts")) score += 6;

if (lower.includes("return null")) score += 3;

if (lower.includes("if (!")) score += 5;

return clampScore(score);

}

function scoreProductDepth(lower: string, paths: string[]) {

let score = 10;

const terms = ["progression", "upgrade", "unlock", "mission", "challenge", "daily", "streak", "achievement", "settings", "analytics", "save", "state", "score", "reward", "economy", "inventory", "level", "experience", "xp", "onboarding"];

score += countHits(lower, terms) * 4;

if (paths.some((path) => path.includes("/data/"))) score += 8;

if (paths.some((path) => path.includes("/systems/"))) score += 10;

if (paths.some((path) => path.includes("/store/"))) score += 6;

return clampScore(score);

}

function scoreCompleteness(paths: string[], lower: string) {

let score = 0;

const critical = ["/package.json", "/index.html", "/src/main.tsx", "/src/App.tsx"];

score += critical.filter((path) => paths.includes(path)).length * 15;

if (paths.includes("/README.md")) score += 10;

if (paths.includes("/src/style.css") || paths.includes("/src/index.css")) score += 8;

if (paths.includes("/vite.config.ts") || paths.includes("/vite.config.js")) score += 8;

if (paths.includes("/tsconfig.json")) score += 5;

if (lower.includes("export default function")) score += 5;

return clampScore(score);

}

function scoreProductionReadiness(paths: string[], lower: string) {

let score = 10;

const terms = ["build", "deploy", "readme", "production", "checklist", "capacitor", "manifest", "offline", "localstorage", "performance", "accessibility", "error", "settings"];

score += countHits(lower, terms) * 4;

if (paths.includes("/README.md")) score += 8;

if (paths.includes("/ANDROID_BUILD.md")) score += 10;

if (paths.includes("/public/manifest.webmanifest")) score += 8;

if (paths.some((path) => path.includes("/icons/"))) score += 5;

return clampScore(score);

}

function scoreGameplay(lower: string, paths: string[]) {

if (!detectGame(lower, paths)) return 0;

let score = 15;

const terms = ["game", "gameplay", "loop", "player", "enemy", "collision", "score", "combo", "level", "spawn", "difficulty", "run", "session", "upgrade", "power", "reward", "particle", "animation", "touch", "tap", "canvas", "requestanimationframe"];

score += countHits(lower, terms) * 4;

if (paths.some((path) => path.includes("/game/"))) score += 10;

if (paths.some((path) => path.includes("/systems/"))) score += 8;

if (paths.some((path) => path.includes("/data/"))) score += 6;

return clampScore(score);

}

function scoreRetention(lower: string) {

let score = 5;

const terms = ["daily reward", "daily", "streak", "mission", "quest", "achievement", "unlock", "progression", "battle pass", "battlepass", "reward", "level", "xp", "challenge", "return", "retention"];

score += countHits(lower, terms) * 6;

return clampScore(score);

}

function scoreMonetization(lower: string) {

let score = 5;

const terms = ["rewarded ad", "rewarded", "ads", "admob", "monetization", "cosmetic", "battle pass", "battlepass", "purchase", "premium", "iap", "no pay-to-win", "not pay-to-win"];

score += countHits(lower, terms) * 6;

return clampScore(score);

}

function scoreAndroidReady(paths: string[], lower: string) {

let score = 0;

if (lower.includes("capacitor")) score += 20;

if (paths.includes("/capacitor.config.ts") || paths.includes("/capacitor.config.json")) score += 20;

if (paths.includes("/ANDROID_BUILD.md")) score += 20;

if (paths.includes("/public/manifest.webmanifest")) score += 10;

if (paths.some((path) => path.includes("/icons/"))) score += 8;

if (lower.includes("android")) score += 8;

if (lower.includes("portrait")) score += 6;

if (lower.includes("viewport")) score += 4;

if (lower.includes("safe-area")) score += 4;

return clampScore(score);

}

function scoreAntiPlaceholder(lower: string) {

let score = 100;

const badTerms = ["todo: implement", "placeholder", "mock data only", "coming soon", "lorem ipsum", "dummy", "fake api", "not implemented", "under construction"];

score -= countHits(lower, badTerms) * 12;

if (lower.includes("generated app recovered safely")) score -= 25;

if (lower.includes("ai returned invalid json")) score -= 25;

return clampScore(score);

}

function countHits(text: string, terms: string[]) {

return terms.reduce((sum, term) => (text.includes(term.toLowerCase()) ? sum + 1 : sum), 0);

}

function detectGame(lower: string, paths: string[]) {

return lower.includes("game") || lower.includes("gameplay") || lower.includes("player") || paths.some((path) => path.includes("/game/"));

}

function detectAndroid(lower: string, paths: string[]) {

return lower.includes("android") || lower.includes("capacitor") || paths.includes("/ANDROID_BUILD.md") || paths.includes("/capacitor.config.ts");

}

function normalizeFiles(files: VirtualFile[]) {

return (files || []).filter((file) => file && file.path);

}

function clampScore(value: number) {

return Math.max(0, Math.min(100, Math.round(value)));

               }
