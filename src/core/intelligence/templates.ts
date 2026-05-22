import type { VirtualFile } from "../engine/types";

export type ProjectTemplateId =
  | "saas"
  | "dashboard"
  | "affiliate"
  | "trading"
  | "mobile"
  | "ai-tool";

export type ProjectTemplate = {
  id: ProjectTemplateId;
  name: string;
  description: string;
  prompt: string;
  files: VirtualFile[];
};

export function listProjectTemplates(): ProjectTemplate[] {
  return [
    createSaasTemplate(),
    createDashboardTemplate(),
    createAffiliateTemplate(),
    createTradingTemplate(),
    createMobileTemplate(),
    createAiToolTemplate(),
  ];
}

export function getProjectTemplate(id: ProjectTemplateId) {
  return listProjectTemplates().find((template) => template.id === id);
}

function basePackageJson(name: string): VirtualFile {
  return {
    path: "/package.json",
    content: JSON.stringify(
      {
        name,
        version: "1.0.0",
        private: true,
        type: "module",
        scripts: {
          dev: "vite",
          build: "vite build",
          preview: "vite preview",
        },
        dependencies: {
          "@tailwindcss/vite": "latest",
          "framer-motion": "latest",
          "lucide-react": "latest",
          react: "latest",
          "react-dom": "latest",
        },
        devDependencies: {
          "@vitejs/plugin-react": "latest",
          typescript: "latest",
          vite: "latest",
        },
      },
      null,
      2
    ),
  };
}

function baseFiles(name: string): VirtualFile[] {
  return [
    basePackageJson(name),
    {
      path: "/index.html",
      content: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${name}</title>
    <meta name="description" content="Generated production-ready application." />
    <meta property="og:title" content="${name}" />
    <meta property="og:description" content="Generated production-ready application." />
    <meta name="twitter:card" content="summary_large_image" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,
    },
    {
      path: "/vite.config.ts",
      content: `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
});
`,
    },
    {
      path: "/tsconfig.json",
      content: JSON.stringify(
        {
          compilerOptions: {
            target: "ES2020",
            useDefineForClassFields: true,
            lib: ["DOM", "DOM.Iterable", "ES2020"],
            allowJs: false,
            skipLibCheck: true,
            esModuleInterop: true,
            allowSyntheticDefaultImports: true,
            strict: true,
            forceConsistentCasingInFileNames: true,
            module: "ESNext",
            moduleResolution: "Node",
            resolveJsonModule: true,
            isolatedModules: true,
            noEmit: true,
            jsx: "react-jsx",
          },
          include: ["src"],
          references: [],
        },
        null,
        2
      ),
    },
    {
      path: "/src/main.tsx",
      content: `import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./style.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`,
    },
    {
      path: "/src/style.css",
      content: `@import "tailwindcss";

* {
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
}

body {
  margin: 0;
  background: #050505;
  color: white;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
`,
    },
    {
      path: "/README.md",
      content: `# ${name}

Generated with Forge AI App Builder.

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
`,
    },
    {
      path: "/.env.example",
      content: `VITE_APP_NAME="${name}"
VITE_PUBLIC_SITE_URL="https://example.com"
`,
    },
  ];
}

function createSaasTemplate(): ProjectTemplate {
  return {
    id: "saas",
    name: "SaaS Starter",
    description: "Landing page, pricing, dashboard, onboarding and conversion sections.",
    prompt:
      "Create a premium mobile-first SaaS app with landing page, onboarding, dashboard, pricing, testimonials, FAQ, SEO metadata, error states and clean reusable components.",
    files: [
      ...baseFiles("forge-saas-starter"),
      {
        path: "/src/App.tsx",
        content: `const features = [
  "Conversion-focused landing page",
  "Reusable dashboard foundation",
  "Pricing and onboarding sections",
];

export default function App() {
  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <section className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-6 py-20">
        <p className="mb-4 text-xs uppercase tracking-[0.35em] text-zinc-500">SaaS Starter</p>
        <h1 className="max-w-4xl text-5xl font-black tracking-tight md:text-7xl">
          Launch a premium SaaS faster.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-400">
          A clean foundation for onboarding, pricing, dashboard and conversion.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <button className="rounded-2xl bg-white px-5 py-3 font-bold text-black">Start now</button>
          <button className="rounded-2xl border border-white/15 px-5 py-3 font-bold text-white">View demo</button>
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {features.map((feature) => (
            <article key={feature} className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <h2 className="font-bold">{feature}</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Ready to be expanded by Forge autopilot.
              </p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
`,
      },
    ],
  };
}

function createDashboardTemplate(): ProjectTemplate {
  return {
    id: "dashboard",
    name: "Analytics Dashboard",
    description: "Admin dashboard with metrics, cards, charts and activity sections.",
    prompt:
      "Create a premium analytics dashboard with responsive sidebar, metric cards, charts, activity feed, settings, empty states, loading states and polished mobile layout.",
    files: [
      ...baseFiles("forge-dashboard"),
      {
        path: "/src/App.tsx",
        content: `const metrics = [
  ["Revenue", "$24,820", "+18%"],
  ["Users", "12,430", "+9%"],
  ["Conversion", "7.8%", "+2.1%"],
  ["Latency", "84ms", "-14%"],
];

export default function App() {
  return (
    <main className="min-h-screen bg-[#050505] p-4 text-white">
      <section className="mx-auto max-w-7xl">
        <div className="mb-6 rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">Dashboard</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight">Command center</h1>
          <p className="mt-3 text-sm text-zinc-400">Monitor core business metrics in one place.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {metrics.map(([label, value, delta]) => (
            <article key={label} className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <p className="text-sm text-zinc-500">{label}</p>
              <p className="mt-3 text-3xl font-black">{value}</p>
              <p className="mt-2 text-sm text-emerald-300">{delta}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
`,
      },
    ],
  };
}

function createAffiliateTemplate(): ProjectTemplate {
  return {
    id: "affiliate",
    name: "Affiliate Deals",
    description: "SEO-oriented affiliate product grid and deal landing page.",
    prompt:
      "Create a premium affiliate deals website with product cards, category filters, deal score, SEO sections, comparison blocks, Amazon-style CTA buttons, mobile-first layout and structured data.",
    files: [
      ...baseFiles("forge-affiliate-deals"),
      {
        path: "/src/App.tsx",
        content: `const products = [
  { name: "Smart Desk Fan", price: "$49", score: "92" },
  { name: "Noise Canceling Earbuds", price: "$79", score: "89" },
  { name: "Portable Monitor", price: "$139", score: "95" },
];

export default function App() {
  return (
    <main className="min-h-screen bg-[#050505] px-4 py-8 text-white">
      <section className="mx-auto max-w-6xl">
        <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">Deals</p>
        <h1 className="mt-3 text-5xl font-black tracking-tight">Best verified deals today</h1>
        <p className="mt-4 max-w-2xl text-zinc-400">A fast, SEO-ready deal discovery foundation.</p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {products.map((product) => (
            <article key={product.name} className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <div className="mb-4 aspect-square rounded-2xl bg-white/10" />
              <p className="text-lg font-bold">{product.name}</p>
              <p className="mt-2 text-3xl font-black">{product.price}</p>
              <p className="mt-2 text-sm text-emerald-300">Deal score {product.score}/100</p>
              <button className="mt-4 w-full rounded-2xl bg-white px-4 py-3 font-bold text-black">
                View deal
              </button>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
`,
      },
    ],
  };
}

function createTradingTemplate(): ProjectTemplate {
  return {
    id: "trading",
    name: "Trading Scanner",
    description: "Trading dashboard foundation with signals, risk, pairs and status.",
    prompt:
      "Create a professional trading scanner dashboard with pair ranking, signal confidence, risk controls, active trades, journal, macro-event warnings and mobile-first layout.",
    files: [
      ...baseFiles("forge-trading-scanner"),
      {
        path: "/src/App.tsx",
        content: `const signals = [
  ["XAUUSD", "Long", "82%", "Medium"],
  ["EURUSD", "Short", "74%", "Low"],
  ["NAS100", "Wait", "61%", "High"],
];

export default function App() {
  return (
    <main className="min-h-screen bg-[#050505] p-4 text-white">
      <section className="mx-auto max-w-6xl">
        <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">Scanner</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight">Trading Scanner</h1>
        <p className="mt-3 text-sm text-zinc-400">Signal confidence, risk and pair ranking.</p>
        <div className="mt-6 space-y-3">
          {signals.map(([pair, direction, confidence, risk]) => (
            <article key={pair} className="grid gap-3 rounded-3xl border border-white/10 bg-white/[0.04] p-5 md:grid-cols-4">
              <p className="font-black">{pair}</p>
              <p>{direction}</p>
              <p className="text-emerald-300">{confidence}</p>
              <p className="text-zinc-400">Risk: {risk}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
`,
      },
    ],
  };
}

function createMobileTemplate(): ProjectTemplate {
  return {
    id: "mobile",
    name: "Mobile App UI",
    description: "Mobile-first application shell with onboarding and cards.",
    prompt:
      "Create a premium mobile-first app UI with onboarding, bottom navigation, cards, settings, notifications, profile screen and smooth micro-interactions.",
    files: [
      ...baseFiles("forge-mobile-app"),
      {
        path: "/src/App.tsx",
        content: `export default function App() {
  return (
    <main className="min-h-screen bg-[#050505] p-4 text-white">
      <section className="mx-auto max-w-sm rounded-[2.5rem] border border-white/10 bg-white/[0.04] p-5 shadow-2xl">
        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Mobile</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight">Your daily command app</h1>
        <div className="mt-8 space-y-3">
          {["Focus session", "Smart reminders", "Progress tracking"].map((item) => (
            <div key={item} className="rounded-3xl bg-white/10 p-4 font-bold">{item}</div>
          ))}
        </div>
        <nav className="mt-8 grid grid-cols-3 gap-2 rounded-3xl bg-black/40 p-2 text-center text-xs text-zinc-400" aria-label="Main navigation">
          <span>Home</span><span>Stats</span><span>Profile</span>
        </nav>
      </section>
    </main>
  );
}
`,
      },
    ],
  };
}

function createAiToolTemplate(): ProjectTemplate {
  return {
    id: "ai-tool",
    name: "AI Tool",
    description: "Prompt-based AI tool layout with output panel and history.",
    prompt:
      "Create a premium AI tool web app with prompt input, generated output panel, history, settings, model selector, loading states, error states and polished mobile-first UX.",
    files: [
      ...baseFiles("forge-ai-tool"),
      {
        path: "/src/App.tsx",
        content: `export default function App() {
  return (
    <main className="min-h-screen bg-[#050505] p-4 text-white">
      <section className="mx-auto grid max-w-6xl gap-4 md:grid-cols-[1fr_360px]">
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">AI Tool</p>
          <h1 className="mt-3 text-5xl font-black tracking-tight">Generate better outputs</h1>
          <label className="mt-8 block">
            <span className="text-sm text-zinc-400">Prompt</span>
            <textarea className="mt-2 min-h-48 w-full rounded-3xl border border-white/10 bg-black/40 p-4 outline-none" placeholder="Write your prompt..." />
          </label>
          <button className="mt-4 rounded-2xl bg-white px-5 py-3 font-bold text-black">Generate</button>
        </div>
        <aside className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          <h2 className="font-bold">Output</h2>
          <p className="mt-4 text-sm leading-7 text-zinc-400">Generated result will appear here.</p>
        </aside>
      </section>
    </main>
  );
}
`,
      },
    ],
  };
      }
