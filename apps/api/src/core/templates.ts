import type { VirtualFile } from "./types";
import { createFallbackProjectFiles } from "./ai";

export function listTemplates() {
  return [
    createTemplate("saas", "SaaS Starter", "Premium SaaS landing page."),
    createTemplate("dashboard", "Dashboard", "Analytics dashboard."),
    createTemplate("affiliate", "Affiliate Deals", "Affiliate product grid."),
    createTemplate("ai-tool", "AI Tool", "Prompt-based AI tool."),
    createTemplate("web-game", "Web Game", "Mobile-first arcade game."),
    createTemplate(
      "android-web-game",
      "Android Web Game",
      "Capacitor-ready mobile game."
    ),
  ];
}

export function createTemplate(
  id: string,
  name: string,
  description: string
) {
  const files = createFallbackProjectFiles().map((file) => {
    if (file.path !== "/src/App.tsx") return file;

    return {
      ...file,
      content: createTemplateApp({ name, description }),
    };
  });

  return {
    id,
    name,
    description,
    prompt: createTemplatePrompt({ id, name }),
    files,
  };
}

function createTemplatePrompt({
  id,
  name,
}: {
  id: string;
  name: string;
}) {
  if (id === "web-game") {
    return "Create a complete mobile-first arcade web game with score, progression, touch controls, restart flow and animated feedback.";
  }

  if (id === "android-web-game") {
    return "Create a complete Android-ready mobile arcade game using React, Vite and Capacitor with touch controls, scoring, progression, SVG sprites and build instructions.";
  }

  if (id === "affiliate") {
    return "Create a premium affiliate deals app with product cards, filters, SEO sections, affiliate CTA buttons, deal scores and comparison sections.";
  }

  if (id === "ai-tool") {
    return "Create a premium AI tool with prompt input, output panel, history, settings, model selector, loading and error states.";
  }

  if (id === "dashboard") {
    return "Create a premium analytics dashboard with metrics, activity feed, filters, charts, responsive cards and status indicators.";
  }

  if (id === "saas") {
    return "Create a premium SaaS landing page with dashboard preview, pricing, onboarding flow, testimonials, FAQ, CTA and settings mock.";
  }

  return `Create a premium ${name} application.`;
}

function createTemplateApp({
  name,
  description,
}: {
  name: string;
  description: string;
}): string {
  return `export default function App() {
  const features = [
    "Mobile-first layout",
    "Production-ready structure",
    "Premium dark interface",
    "Clear user flow"
  ];

  return (
    <main className="min-h-screen bg-[#050505] px-6 py-16 text-white">
      <section className="mx-auto max-w-6xl rounded-3xl border border-white/10 bg-white/[0.04] p-8 shadow-2xl">
        <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">
          AutoApp Template
        </p>

        <h1 className="mt-4 text-5xl font-black tracking-tight md:text-7xl">
          ${escapeForTemplate(name)}
        </h1>

        <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-400">
          ${escapeForTemplate(description)}
        </p>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {features.map((feature) => (
            <article
              key={feature}
              className="rounded-2xl border border-white/10 bg-black/30 p-5"
            >
              <p className="text-sm font-bold text-white">{feature}</p>
              <p className="mt-2 text-sm leading-6 text-zinc-500">
                Ready to be expanded by AutoApp autonomous generation.
              </p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
`;
}

function escapeForTemplate(value: string) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\$/g, "\\$");
}

export function createEmptyMemory(projectId: string) {
  return {
    projectId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    architectureNotes: [],
    codingStyle: [],
    recurringProblems: [],
    successfulFixes: [],
    preferredLibraries: [],
    rejectedPatterns: [],
    buildHistory: [],
    aiDecisions: [],
  };
}

export function createDeploymentPack(files: VirtualFile[]) {
  const paths = new Set(files.map((file) => file.path));

  const additions: VirtualFile[] = [];

  if (!paths.has("/README.md")) {
    additions.push({
      path: "/README.md",
      content: "# Generated App\n\nGenerated with AutoApp.\n",
    });
  }

  if (!paths.has("/.env.example")) {
    additions.push({
      path: "/.env.example",
      content: 'VITE_APP_NAME="Generated App"\n',
    });
  }

  if (!paths.has("/vercel.json")) {
    additions.push({
      path: "/vercel.json",
      content: JSON.stringify(
        {
          buildCommand: "npm run build",
          outputDirectory: "dist",
          installCommand: "npm install",
          framework: "vite",
          rewrites: [
            {
              source: "/(.*)",
              destination: "/",
            },
          ],
        },
        null,
        2
      ),
    });
  }

  if (!paths.has("/DEPLOYMENT.md")) {
    additions.push({
      path: "/DEPLOYMENT.md",
      content: `# Deployment Guide

## Cloudflare Pages

\`\`\`txt
Build command: npm run build
Build output directory: dist
Root directory: /
\`\`\`

## Vercel

\`\`\`txt
Framework: Vite
Build command: npm run build
Output directory: dist
\`\`\`
`,
    });
  }

  return additions;
}
