import type { VirtualFile } from "./types";

export function createGeneratedGameAssets(prompt: string): VirtualFile[] {

const theme = detectTheme(prompt);

return [

{ path: "/src/data/gameBalance.ts", content: buildGameBalance(theme) },

{ path: "/src/data/retention.ts", content: buildRetentionData() },

{ path: "/src/data/monetization.ts", content: buildMonetizationData() },

{ path: "/src/assets/game-icons.svg", content: buildSvgIcons(theme) },

{ path: "/src/game/effects.ts", content: buildEffectsSystem() },

];

}

export function createAndroidCapacitorFiles(prompt: string): VirtualFile[] {

return [

{

path: "/capacitor.config.ts",

content:

'import type { CapacitorConfig } from "@capacitor/cli";\n\nconst config: CapacitorConfig = {\n appId: "com.autoapp.generatedgame",\n appName: "AutoApp Game",\n webDir: "dist",\n bundledWebRuntime: false,\n server: {\n androidScheme: "https"\n }\n};\n\nexport default config;\n',

},

{

path: "/ANDROID_BUILD.md",

content: [

"# Android build guide",

"",

"This project is Android-ready through Capacitor.",

"",

"## Commands",

"",

"```bash",

"npm install",

"npm run build",

"npm install @capacitor/core @capacitor/cli @capacitor/android",

"npx cap add android",

"npx cap sync android",

"npx cap open android",

"```",

"",

"## Notes",

"",

"- Cloudflare Workers cannot build APK/AAB files.",

"- Use Android Studio or a real CI Android build machine.",

"- Configure real app icons, signing keys, AdMob IDs, and Play Store metadata before release.",

"- Keep monetization fair and avoid pay-to-win mechanics.",

].join("\n"),

},

{

path: "/public/manifest.webmanifest",

content: JSON.stringify(

{

name: "AutoApp Game",

short_name: "AutoGame",

start_url: "/",

display: "standalone",

background_color: "#050505",

theme_color: "#050505",

orientation: "portrait",

icons: [

{ src: "/icons/icon-192.svg", sizes: "192x192", type: "image/svg+xml" },

{ src: "/icons/icon-512.svg", sizes: "512x512", type: "image/svg+xml" },

],

},

null,

2

),

},

{ path: "/public/icons/icon-192.svg", content: buildAppIcon("192") },

{ path: "/public/icons/icon-512.svg", content: buildAppIcon("512") },

];

}

export function createFinalPackagingFiles({ prompt, target, files, score }: { prompt: string; target: string; files: VirtualFile[]; score: any }): VirtualFile[] {

return [

{

path: "/README.md",

content: [

"# AutoApp Generated Project",

"",

"Production-oriented project generated and improved by AutoApp.",

"",

"## Target",

"",

`- ${target}`,

"",

"## Current quality",

"",

`- Score: ${score.total}/100`,

`- Architecture: ${score.architecture}/100`,

`- UI: ${score.ui}/100`,

`- Mobile: ${score.mobile}/100`,

`- Reliability: ${score.reliability}/100`,

`- Gameplay: ${score.gameplay || 0}/100`,

`- Retention: ${score.retention || 0}/100`,

`- Android ready: ${score.androidReady || 0}/100`,

"",

"## Commands",

"",

"```bash",

"npm install",

"npm run build",

"npm run preview",

"```",

"",

"## Original prompt",

"",

"```txt",

prompt,

"```",

].join("\n"),

},

];

}

function buildGameBalance(theme: string) {

return `export type UpgradeDefinition = {

id: string;

name: string;

description: string;

maxLevel: number;

baseCost: number;

costGrowth: number;

effectPerLevel: number;

};

export const GAME_THEME = ${JSON.stringify(theme)};

export const PLAYER_BASE = {

health: 100,

speed: 1,

magnetRadius: 80,

comboWindowMs: 1400,

reviveCost: 1,

};

export const DIFFICULTY_CURVE = {

spawnGrowth: 0.08,

speedGrowth: 0.035,

rewardGrowth: 0.06,

bossEveryRuns: 5,

};

export const UPGRADES: UpgradeDefinition[] = [

{ id: "speed", name: "Hyper Steps", description: "Move faster and recover from mistakes.", maxLevel: 20, baseCost: 80, costGrowth: 1.18, effectPerLevel: 0.035 },

{ id: "magnet", name: "Reward Magnet", description: "Collect rewards from farther away.", maxLevel: 20, baseCost: 70, costGrowth: 1.16, effectPerLevel: 8 },

{ id: "combo", name: "Combo Core", description: "Keep score multipliers active longer.", maxLevel: 15, baseCost: 110, costGrowth: 1.2, effectPerLevel: 120 },

{ id: "shield", name: "Impact Shield", description: "Start runs with extra protection.", maxLevel: 10, baseCost: 160, costGrowth: 1.24, effectPerLevel: 1 },

];

export const REWARD_TABLE = {

baseCoins: 24,

perfectRunBonus: 75,

comboMilestones: [5, 10, 20, 35, 50],

missionBonus: 120,

};

`;

}

function buildRetentionData() {

return `export const DAILY_REWARDS = [

{ day: 1, coins: 100, gems: 0, label: "Starter Boost" },

{ day: 2, coins: 140, gems: 0, label: "Momentum" },

{ day: 3, coins: 180, gems: 1, label: "Rare Spark" },

{ day: 4, coins: 240, gems: 1, label: "Power Push" },

{ day: 5, coins: 320, gems: 2, label: "Epic Cache" },

{ day: 6, coins: 420, gems: 2, label: "Master Cache" },

{ day: 7, coins: 600, gems: 5, label: "Legendary Drop" },

];

export const MISSIONS = [

{ id: "combo_10", title: "Reach a 10x combo", rewardCoins: 120 },

{ id: "survive_90", title: "Survive for 90 seconds", rewardCoins: 160 },

{ id: "collect_200", title: "Collect 200 shards", rewardCoins: 180 },

{ id: "upgrade_once", title: "Buy any upgrade", rewardCoins: 90 },

];

export const ACHIEVEMENTS = [

{ id: "first_run", title: "First Run", rewardCoins: 50 },

{ id: "first_upgrade", title: "First Upgrade", rewardCoins: 80 },

{ id: "combo_master", title: "Combo Master", rewardCoins: 300 },

{ id: "week_streak", title: "7-Day Streak", rewardCoins: 700 },

];

`;

}

function buildMonetizationData() {

return `export const MONETIZATION_CONFIG = {

rewardedAds: {

enabled: true,

placements: [

{ id: "double_rewards", label: "Double run rewards", cooldownSeconds: 45 },

{ id: "revive_once", label: "One revive per run", cooldownSeconds: 120 },

{ id: "daily_bonus", label: "Bonus daily chest", cooldownSeconds: 300 },

],

},

cosmetics: {

enabled: true,

noPayToWin: true,

starterSkins: ["Nova", "Pulse", "Ion"],

},

battlePass: {

enabled: true,

freeTrack: true,

premiumTrackHook: true,

noPowerLockedBehindPremium: true,

},

};

export function canShowRewardedAd(lastShownAt: number, cooldownSeconds: number) {

return Date.now() - lastShownAt >= cooldownSeconds * 1000;

}

`;

}

function buildSvgIcons(theme: string) {

return `<svg xmlns="http://www.w3.org/2000/svg" style="display:none">

<symbol id="icon-player" viewBox="0 0 64 64"><path d="M32 4L58 54H6L32 4Z" fill="url(#g1)"/></symbol>

<symbol id="icon-coin" viewBox="0 0 64 64"><circle cx="32" cy="32" r="24" fill="#facc15"/><circle cx="32" cy="32" r="14" fill="#f59e0b"/></symbol>

<symbol id="icon-gem" viewBox="0 0 64 64"><path d="M12 22L24 8H40L52 22L32 58L12 22Z" fill="#38bdf8"/></symbol>

<defs><linearGradient id="g1" x1="0" x2="1"><stop offset="0%" stop-color="#22d3ee"/><stop offset="100%" stop-color="#a78bfa"/></linearGradient></defs>

<metadata>${theme}</metadata>

</svg>`;

}

function buildEffectsSystem() {

return `export type Particle = {

id: string;

x: number;

y: number;

vx: number;

vy: number;

life: number;

color: string;

size: number;

};

export function createBurst(x: number, y: number, amount = 16): Particle[] {

return Array.from({ length: amount }).map((_, index) => {

const angle = (Math.PI * 2 * index) / amount;

const speed = 1 + Math.random() * 3;

return { id: crypto.randomUUID(), x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 1, color: index % 2 === 0 ? "#22d3ee" : "#a78bfa", size: 3 + Math.random() * 5 };

});

}

export function updateParticles(particles: Particle[], delta: number) {

return particles

.map((particle) => ({ ...particle, x: particle.x + particle.vx * delta, y: particle.y + particle.vy * delta, vy: particle.vy + 0.012 * delta, life: particle.life - 0.018 * delta }))

.filter((particle) => particle.life > 0);

}

`;

}

function buildAppIcon(size: string) {

return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#050505"/><circle cx="256" cy="256" r="178" fill="#111827"/><path d="M256 82L396 390H116L256 82Z" fill="url(#g)"/><circle cx="256" cy="278" r="54" fill="#050505" opacity=".65"/><defs><linearGradient id="g" x1="116" x2="396" y1="82" y2="390"><stop stop-color="#22d3ee"/><stop offset="1" stop-color="#a78bfa"/></linearGradient></defs></svg>`;

}

function detectTheme(prompt: string) {

const lower = prompt.toLowerCase();

if (lower.includes("space")) return "space neon";

if (lower.includes("ninja")) return "neon ninja";

if (lower.includes("survivor")) return "survival arena";

if (lower.includes("runner")) return "speed runner";

return "neon arcade";

}
