import type { ProjectScore, VirtualFile } from "./types";

function hasFile(files: VirtualFile[], names: string[]) {
  return files.some((file) =>
    names.some((name) => file.path.toLowerCase().endsWith(name.toLowerCase()))
  );
}

function hasContent(files: VirtualFile[], keywords: string[]) {
  const all = files.map((f) => f.content || "").join("\n").toLowerCase();
  return keywords.some((k) => all.includes(k.toLowerCase()));
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function scoreProject(files: VirtualFile[]): ProjectScore {
  const hasPackage = hasFile(files, ["package.json"]);
  const hasVite = hasFile(files, ["vite.config.ts", "vite.config.js"]);
  const hasApp = hasFile(files, ["app.tsx", "app.jsx", "main.tsx", "main.jsx"]);
  const hasComponents = files.filter((f) => f.path.includes("/components/")).length >= 3;
  const hasHooks = files.some((f) => f.path.includes("/hooks/"));
  const hasLib = files.some((f) => f.path.includes("/lib/"));
  const hasCss = hasFile(files, ["index.css", "globals.css"]);
  const hasMeta = hasContent(files, ["og:title", "description", "twitter:card"]);
  const hasResponsive = hasContent(files, ["sm:", "md:", "lg:", "grid", "flex"]);
  const hasA11y = hasContent(files, ["aria-", "role=", "alt="]);
  const hasErrorHandling = hasContent(files, ["try {", "catch", "error", "fallback"]);
  const hasPremiumUi = hasContent(files, ["gradient", "shadow", "rounded", "backdrop", "motion"]);
  const hasSEO = hasFile(files, ["robots.txt", "sitemap.xml"]) || hasMeta;
  const hasTests = hasFile(files, [".test.ts", ".test.tsx", ".spec.ts", ".spec.tsx"]);
  const hasEnv = hasFile(files, [".env.example"]);
  const hasReadme = hasFile(files, ["readme.md"]);

  const architecture = clamp(
    25 +
      Number(hasPackage) * 10 +
      Number(hasVite) * 10 +
      Number(hasApp) * 10 +
      Number(hasComponents) * 20 +
      Number(hasHooks) * 10 +
      Number(hasLib) * 10 +
      Number(hasReadme) * 5
  );

  const ui = clamp(30 + Number(hasCss) * 15 + Number(hasPremiumUi) * 30 + Number(hasComponents) * 25);
  const mobile = clamp(35 + Number(hasResponsive) * 45 + Number(hasA11y) * 20);
  const performance = clamp(45 + Number(hasVite) * 20 + Number(hasLib) * 15 + Number(hasErrorHandling) * 20);
  const accessibility = clamp(30 + Number(hasA11y) * 50 + Number(hasResponsive) * 20);
  const seo = clamp(20 + Number(hasSEO) * 50 + Number(hasMeta) * 20 + Number(hasReadme) * 10);
  const maintainability = clamp(30 + Number(hasComponents) * 25 + Number(hasHooks) * 15 + Number(hasLib) * 15 + Number(hasTests) * 15);
  const monetization = clamp(20 + Number(hasContent(files, ["pricing", "stripe", "affiliate", "checkout", "subscribe"])) * 60);
  const reliability = clamp(30 + Number(hasErrorHandling) * 35 + Number(hasEnv) * 15 + Number(hasTests) * 20);

  const total = clamp(
    (ui +
      mobile +
      performance +
      accessibility +
      seo +
      maintainability +
      architecture +
      monetization +
      reliability) /
      9
  );

  return {
    ui,
    mobile,
    performance,
    accessibility,
    seo,
    maintainability,
    architecture,
    monetization,
    reliability,
    total,
  };
    }
