import type { VirtualFile } from "./types";
import { normalizePath } from "./files";
import { detectTarget, getTargetProfile } from "./targets";

export function createGeneratedGameAssets(prompt: string): VirtualFile[] {
  const target = detectTarget(prompt);

  if (!target.includes("game")) return [];

  return [
    {
      path: "/src/assets/player.svg",
      content: `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">
  <defs>
    <linearGradient id="ship" x1="0" x2="1" y1="0" y2="1">
      <stop stop-color="#67e8f9"/>
      <stop offset=".5" stop-color="#818cf8"/>
      <stop offset="1" stop-color="#c084fc"/>
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="4" result="b"/>
      <feMerge>
        <feMergeNode in="b"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <path filter="url(#glow)" d="M80 10 L136 146 L80 118 L24 146 Z" fill="url(#ship)" stroke="#f8fafc" stroke-opacity=".9" stroke-width="5"/>
  <circle cx="80" cy="72" r="18" fill="#020617" stroke="#f8fafc" stroke-opacity=".9" stroke-width="4"/>
  <path d="M58 112 C70 124 90 124 102 112" stroke="#f8fafc" stroke-width="5" stroke-linecap="round" fill="none"/>
</svg>`,
    },
    {
      path: "/src/assets/enemy.svg",
      content: `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">
  <defs>
    <radialGradient id="enemy" cx=".5" cy=".4">
      <stop stop-color="#fb7185"/>
      <stop offset=".55" stop-color="#ef4444"/>
      <stop offset="1" stop-color="#7f1d1d"/>
    </radialGradient>
    <filter id="shadow">
      <feDropShadow dx="0" dy="8" stdDeviation="8" flood-color="#000" flood-opacity=".55"/>
    </filter>
  </defs>
  <path filter="url(#shadow)" d="M80 12 C122 12 148 43 148 82 C148 124 118 148 80 148 C42 148 12 124 12 82 C12 43 38 12 80 12Z" fill="url(#enemy)" stroke="#fff1f2" stroke-opacity=".8" stroke-width="5"/>
  <circle cx="56" cy="70" r="10" fill="#020617"/>
  <circle cx="104" cy="70" r="10" fill="#020617"/>
  <path d="M50 108 Q80 132 110 108" stroke="#020617" stroke-width="8" fill="none" stroke-linecap="round"/>
  <path d="M34 38 L10 18 M126 38 L150 18" stroke="#fb7185" stroke-width="8" stroke-linecap="round"/>
</svg>`,
    },
    {
      path: "/src/assets/coin.svg",
      content: `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="coin" x1="0" x2="1">
      <stop stop-color="#fef08a"/>
      <stop offset=".5" stop-color="#facc15"/>
      <stop offset="1" stop-color="#ca8a04"/>
    </linearGradient>
  </defs>
  <circle cx="64" cy="64" r="50" fill="url(#coin)" stroke="#fff7ad" stroke-width="8"/>
  <circle cx="64" cy="64" r="32" fill="none" stroke="#a16207" stroke-width="6"/>
  <path d="M64 30 L72 54 L98 54 L76 69 L84 96 L64 80 L44 96 L52 69 L30 54 L56 54Z" fill="#fff7ad"/>
</svg>`,
    },
    {
      path: "/src/assets/background-stars.svg",
      content: `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
  <rect width="800" height="800" fill="#020617"/>
  <g fill="#ffffff">
    <circle cx="80" cy="120" r="2" opacity=".7"/>
    <circle cx="220" cy="90" r="1.5" opacity=".5"/>
    <circle cx="520" cy="180" r="2.5" opacity=".8"/>
    <circle cx="700" cy="260" r="1.5" opacity=".5"/>
    <circle cx="140" cy="420" r="2" opacity=".6"/>
    <circle cx="390" cy="360" r="1.5" opacity=".5"/>
    <circle cx="620" cy="520" r="2.5" opacity=".7"/>
    <circle cx="300" cy="700" r="2" opacity=".6"/>
    <circle cx="740" cy="720" r="1.5" opacity=".5"/>
  </g>
</svg>`,
    },
    {
      path: "/src/assets/fx.css",
      content: `.sprite-glow {
  filter: drop-shadow(0 0 14px rgba(103, 232, 249, .7));
}

.hit-flash {
  animation: hitFlash .24s ease-out;
}

.collect-pop {
  animation: collectPop .36s cubic-bezier(.2, 1.4, .4, 1);
}

.level-pulse {
  animation: levelPulse .8s ease-in-out infinite alternate;
}

@keyframes hitFlash {
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.16); opacity: .65; }
  100% { transform: scale(1); opacity: 1; }
}

@keyframes collectPop {
  0% { transform: scale(.6) rotate(-8deg); opacity: .2; }
  70% { transform: scale(1.18) rotate(4deg); opacity: 1; }
  100% { transform: scale(1) rotate(0deg); opacity: 1; }
}

@keyframes levelPulse {
  from { box-shadow: 0 0 20px rgba(34, 211, 238, .25); }
  to { box-shadow: 0 0 42px rgba(168, 85, 247, .55); }
}
`,
    },
    {
      path: "/src/assets/sprite-manifest.json",
      content: JSON.stringify(
        {
          generated: true,
          type: "svg-sprites",
          style: "premium-neon-arcade",
          assets: [
            "/src/assets/player.svg",
            "/src/assets/enemy.svg",
            "/src/assets/coin.svg",
            "/src/assets/background-stars.svg",
            "/src/assets/fx.css",
          ],
          usage:
            "Import SVG paths or reference them as image sources in React/Vite. Import fx.css for hit, collect and glow effects.",
        },
        null,
        2
      ),
    },
  ];
}

export function createAndroidCapacitorFiles(prompt: string): VirtualFile[] {
  const target = detectTarget(prompt);

  if (!target.includes("android")) return [];

  return [
    {
      path: "/capacitor.config.ts",
      content: `import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.autoapp.generated",
  appName: "AutoApp Generated Game",
  webDir: "dist",
  bundledWebRuntime: false,
  server: {
    androidScheme: "https"
  }
};

export default config;
`,
    },
    {
      path: "/manifest.webmanifest",
      content: JSON.stringify(
        {
          name: "AutoApp Generated Game",
          short_name: "AutoGame",
          description:
            "A mobile-first Android-ready game generated by AutoApp.",
          start_url: "/",
          display: "standalone",
          background_color: "#020617",
          theme_color: "#020617",
          orientation: "portrait",
          icons: [
            {
              src: "/icons/icon-192.svg",
              sizes: "192x192",
              type: "image/svg+xml",
              purpose: "any maskable",
            },
            {
              src: "/icons/icon-512.svg",
              sizes: "512x512",
              type: "image/svg+xml",
              purpose: "any maskable",
            },
          ],
        },
        null,
        2
      ),
    },
    {
      path: "/public/icons/icon-192.svg",
      content: createAppIconSvg(192),
    },
    {
      path: "/public/icons/icon-512.svg",
      content: createAppIconSvg(512),
    },
    {
      path: "/ANDROID_BUILD.md",
      content: `# Android Build Guide

This project is Android-ready through Capacitor.

## Requirements

- Node.js 20+
- Android Studio
- Java JDK 17+
- Android SDK installed

## Install

\`\`\`bash
npm install
\`\`\`

## Build web app

\`\`\`bash
npm run build
\`\`\`

## Add Android platform

\`\`\`bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap add android
\`\`\`

## Sync web build to Android

\`\`\`bash
npx cap sync android
\`\`\`

## Open Android Studio

\`\`\`bash
npx cap open android
\`\`\`

## Build APK / AAB

In Android Studio:

\`\`\`txt
Build → Generate Signed Bundle / APK
\`\`\`

## Notes

- The app is generated as a mobile-first web game.
- Capacitor wraps it into a native Android shell.
- For Play Store release, replace appId, appName, icons and signing config.
`,
    },
  ];
}

export function createAppIconSvg(size: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop stop-color="#020617"/>
      <stop offset=".55" stop-color="#312e81"/>
      <stop offset="1" stop-color="#0891b2"/>
    </linearGradient>
    <linearGradient id="ship" x1="0" x2="1" y1="0" y2="1">
      <stop stop-color="#67e8f9"/>
      <stop offset="1" stop-color="#c084fc"/>
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="${Math.max(4, size / 32)}" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <rect width="${size}" height="${size}" rx="${size * 0.22}" fill="url(#bg)"/>
  <circle cx="${size * 0.72}" cy="${size * 0.24}" r="${size * 0.12}" fill="#facc15" opacity=".9"/>
  <path filter="url(#glow)" d="M${size * 0.5} ${size * 0.16} L${size * 0.78} ${size * 0.78} L${size * 0.5} ${size * 0.64} L${size * 0.22} ${size * 0.78} Z" fill="url(#ship)" stroke="white" stroke-width="${size * 0.035}" stroke-linejoin="round"/>
</svg>`;
}

export function createFinalPackagingFiles({
  prompt,
  target,
  files,
  score,
}: {
  prompt: string;
  target: string;
  files: VirtualFile[];
  score: any;
}): VirtualFile[] {
  const profile = getTargetProfile(target);
  const isAndroid = target.includes("android");
  const isGame = target.includes("game");
  const paths = files.map((file) => normalizePath(file.path));

  const additions: VirtualFile[] = [];

  additions.push({
    path: "/README.md",
    content: createFinalReadme({
      prompt,
      target,
      profile,
      score,
      isAndroid,
      isGame,
    }),
  });

  additions.push({
    path: "/.env.example",
    content: createFinalEnvExample(target),
  });

  additions.push({
    path: "/DEPLOYMENT.md",
    content: createDeploymentGuide({
      isAndroid,
      isGame,
    }),
  });

  additions.push({
    path: "/RELEASE_CHECKLIST.md",
    content: createReleaseChecklist({
      target,
      profile,
      isAndroid,
      isGame,
    }),
  });

  if (!paths.includes("/robots.txt")) {
    additions.push({
      path: "/robots.txt",
      content: "User-agent: *\nAllow: /\nSitemap: /sitemap.xml\n",
    });
  }

  if (!paths.includes("/sitemap.xml")) {
    additions.push({
      path: "/sitemap.xml",
      content:
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>https://example.com/</loc>\n    <priority>1.0</priority>\n  </url>\n</urlset>\n',
    });
  }

  if (isGame && !paths.includes("/src/assets/sprite-manifest.json")) {
    additions.push(...createGeneratedGameAssets(prompt));
  }

  if (isAndroid) {
    additions.push(...createAndroidCapacitorFiles(prompt));
  }

  return additions;
}

function createFinalReadme({
  prompt,
  target,
  profile,
  score,
  isAndroid,
  isGame,
}: {
  prompt: string;
  target: string;
  profile: ReturnType<typeof getTargetProfile>;
  score: any;
  isAndroid: boolean;
  isGame: boolean;
}) {
  return `# AutoApp Generated Project

## Purpose

${prompt}

## Target

${profile.label} (${target})

## Current Quality Score

${score?.total || 0}/100

## Included Capabilities

${profile.requiredFeatures.map((item) => `- ${item}`).join("\n")}

## Project Type

${isGame ? "- Game-ready project with gameplay, scoring, feedback and assets." : "- Web application project."}
${isAndroid ? "- Android-ready through Capacitor." : "- Web deployment-ready."}

## Install

\`\`\`bash
npm install
\`\`\`

## Development

\`\`\`bash
npm run dev
\`\`\`

## Build

\`\`\`bash
npm run build
\`\`\`

## Preview

\`\`\`bash
npm run preview
\`\`\`

## Deploy on Cloudflare Pages

Use:

\`\`\`txt
Build command: npm run build
Build output directory: dist
Root directory: /
\`\`\`

${
  isAndroid
    ? `## Android Build

This project includes Capacitor support.

Read:

\`\`\`txt
ANDROID_BUILD.md
\`\`\`

Basic commands:

\`\`\`bash
npm install
npm run build
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap add android
npx cap sync android
npx cap open android
\`\`\`
`
    : ""
}

## Notes

This project was generated autonomously by AutoApp using phased generation, virtual build checks, dependency repair and final packaging.
`;
}

function createFinalEnvExample(target: string) {
  if (target === "ai-tool") {
    return `VITE_APP_NAME="AutoApp Generated AI Tool"
VITE_API_BASE_URL=""
VITE_DEFAULT_MODEL="gemini-2.5-flash"
`;
  }

  if (target.includes("android")) {
    return `VITE_APP_NAME="AutoApp Android App"
VITE_TARGET_PLATFORM="android"
`;
  }

  if (target.includes("game")) {
    return `VITE_APP_NAME="AutoApp Game"
VITE_GAME_MODE="arcade"
`;
  }

  return `VITE_APP_NAME="AutoApp Generated Project"
`;
}

function createDeploymentGuide({
  isAndroid,
  isGame,
}: {
  isAndroid: boolean;
  isGame: boolean;
}) {
  return `# Deployment Guide

## Web Deployment

Recommended free deployment:

- GitHub
- Cloudflare Pages

## Cloudflare Pages Settings

\`\`\`txt
Framework preset: Vite
Build command: npm run build
Build output directory: dist
Root directory: /
\`\`\`

## Build Locally

\`\`\`bash
npm install
npm run build
\`\`\`

## Game Notes

${
  isGame
    ? `This project includes local game assets and should work as a mobile-first web game.

Check:

\`\`\`txt
/src/assets
\`\`\`
`
    : "This project is a standard web app."
}

## Android Notes

${
  isAndroid
    ? `This project is Android-ready through Capacitor.

Cloudflare Workers cannot build APK/AAB files.

To build Android:

\`\`\`bash
npm install
npm run build
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap add android
npx cap sync android
npx cap open android
\`\`\`

Then build APK/AAB inside Android Studio.
`
    : "Android packaging is not enabled for this target."
}

## Production Checklist

- Verify npm run build
- Test mobile layout
- Test primary user flow
- Check accessibility
- Replace placeholder domain in sitemap.xml
- Configure environment variables
- Deploy to Cloudflare Pages
`;
}

function createReleaseChecklist({
  target,
  profile,
  isAndroid,
  isGame,
}: {
  target: string;
  profile: ReturnType<typeof getTargetProfile>;
  isAndroid: boolean;
  isGame: boolean;
}) {
  return `# Release Checklist

## Target

${profile.label} (${target})

## Required Feature Checks

${profile.requiredFeatures.map((item) => `- [ ] ${item}`).join("\n")}

## Quality Checks

- [ ] App loads without runtime errors
- [ ] npm install works
- [ ] npm run build works
- [ ] Main user flow works
- [ ] Mobile layout works
- [ ] Empty states are visible
- [ ] Loading states are visible
- [ ] Error states are visible
- [ ] Buttons have clear labels
- [ ] SEO metadata is present
- [ ] README is accurate

${
  isGame
    ? `## Game Checks

- [ ] Start screen works
- [ ] Controls work on mobile
- [ ] Score updates correctly
- [ ] Difficulty progresses
- [ ] Game over screen works
- [ ] Restart works
- [ ] Sprites/assets load correctly
- [ ] Animations feel responsive
`
    : ""
}

${
  isAndroid
    ? `## Android Checks

- [ ] manifest.webmanifest is present
- [ ] capacitor.config.ts is present
- [ ] Icons are present
- [ ] npm run build succeeds
- [ ] npx cap sync android works
- [ ] Android Studio opens project
- [ ] APK/AAB builds successfully
`
    : ""
}
`;
            }
