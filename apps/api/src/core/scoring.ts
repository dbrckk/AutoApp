import type { VirtualFile } from "./types";
import { clamp, normalizePath, readPackageJson } from "./files";

export function scoreProject(files: VirtualFile[]) {
  const paths = files.map((file) => normalizePath(file.path));
  const all = files
    .map((file) => file.content || "")
    .join("\n")
    .toLowerCase();

  const appFile = files.find(
    (file) => normalizePath(file.path) === "/src/App.tsx"
  );

  const appContent = String(appFile?.content || "").toLowerCase();

  const packageJson = readPackageJson(files);

  const dependencies = {
    ...(packageJson?.dependencies || {}),
    ...(packageJson?.devDependencies || {}),
  };

  const architecture = clamp(
    8 +
      Number(paths.includes("/package.json")) * 10 +
      Number(paths.includes("/index.html")) * 8 +
      Number(paths.includes("/vite.config.ts") || paths.includes("/vite.config.js")) * 8 +
      Number(paths.includes("/tsconfig.json")) * 6 +
      Number(paths.includes("/src/main.tsx") || paths.includes("/src/main.jsx")) * 8 +
      Number(paths.includes("/src/App.tsx") || paths.includes("/src/App.jsx")) * 8 +
      Number(paths.some((path) => path.includes("/components/"))) * 12 +
      Number(paths.some((path) => path.includes("/lib/"))) * 8 +
      Number(paths.some((path) => path.includes("/hooks/"))) * 6 +
      Number(all.includes("type ") || all.includes("interface ")) * 8 +
      Number(files.length >= 7) * 8 +
      Number(files.length >= 12) * 8
  );

  const ui = clamp(
    5 +
      Number(all.includes("rounded")) * 8 +
      Number(all.includes("shadow")) * 8 +
      Number(all.includes("border")) * 6 +
      Number(all.includes("gradient") || all.includes("bg-[")) * 8 +
      Number(all.includes("grid")) * 6 +
      Number(all.includes("card")) * 6 +
      Number(all.includes("sidebar") || all.includes("nav")) * 7 +
      Number(all.includes("modal") || all.includes("panel")) * 5 +
      Number(all.includes("status") || all.includes("badge") || all.includes("chip")) * 6 +
      Number(all.includes("hover:") || all.includes("transition")) * 6 +
      Number(appContent.length > 6000) * 8 +
      Number(appContent.length > 12000) * 8 +
      Number(all.includes("dark") || all.includes("#050505")) * 6
  );

  const mobile = clamp(
    5 +
      Number(all.includes("viewport")) * 12 +
      Number(all.includes("sm:") || all.includes("md:")) * 14 +
      Number(all.includes("lg:") || all.includes("xl:")) * 8 +
      Number(all.includes("flex")) * 8 +
      Number(all.includes("grid")) * 8 +
      Number(all.includes("min-h-screen")) * 8 +
      Number(all.includes("max-w-")) * 8 +
      Number(all.includes("overflow-auto") || all.includes("overflow-hidden")) * 6 +
      Number(all.includes("truncate") || all.includes("line-clamp")) * 5 +
      Number(appContent.includes("md:grid") || appContent.includes("lg:grid")) * 10
  );

  const performance = clamp(
    25 +
      Number(paths.includes("/vite.config.ts") || paths.includes("/vite.config.js")) * 14 +
      Number(!all.includes("setinterval(")) * 8 +
      Number(!all.includes("while (true")) * 8 +
      Number(appContent.length < 45000) * 10 +
      Number(!all.includes("base64,")) * 10 +
      Number(!all.includes("console.log")) * 8 +
      Number(files.length < 60) * 7
  );

  const accessibility = clamp(
    5 +
      Number(all.includes("aria-")) * 14 +
      Number(all.includes("alt=")) * 10 +
      Number(all.includes("<label") || all.includes("label")) * 10 +
      Number(all.includes("<button")) * 8 +
      Number(all.includes("<main")) * 8 +
      Number(all.includes("<section")) * 8 +
      Number(all.includes("<nav")) * 8 +
      Number(all.includes("focus:") || all.includes("focus-visible")) * 8 +
      Number(!all.includes("onclick={undefined")) * 6 +
      Number(all.includes("disabled")) * 6
  );

  const seo = clamp(
    5 +
      Number(all.includes("<title>") || all.includes("title>")) * 10 +
      Number(all.includes("description")) * 12 +
      Number(all.includes("og:title")) * 12 +
      Number(all.includes("og:description")) * 10 +
      Number(all.includes("twitter:card")) * 8 +
      Number(paths.includes("/robots.txt")) * 8 +
      Number(paths.includes("/sitemap.xml")) * 8 +
      Number(all.includes("schema.org") || all.includes("json-ld")) * 12 +
      Number(paths.includes("/README.md")) * 10
  );

  const maintainability = clamp(
    8 +
      Number(all.includes("const ")) * 6 +
      Number(all.includes("function ")) * 6 +
      Number(all.includes("type ") || all.includes("interface ")) * 8 +
      Number(paths.some((path) => path.includes("/components/"))) * 10 +
      Number(paths.some((path) => path.includes("/lib/"))) * 8 +
      Number(paths.some((path) => path.includes("/hooks/"))) * 8 +
      Number(!all.includes("any")) * 8 +
      Number(!all.includes("todo")) * 8 +
      Number(!all.includes("lorem ipsum")) * 8 +
      Number(paths.includes("/README.md")) * 8 +
      Number(appContent.length > 4000 && appContent.length < 45000) * 12
  );

  const monetization = clamp(
    5 +
      Number(all.includes("pricing")) * 18 +
      Number(all.includes("checkout") || all.includes("subscribe")) * 16 +
      Number(all.includes("plan") || all.includes("premium")) * 12 +
      Number(all.includes("cta") || all.includes("get started") || all.includes("start now")) * 12 +
      Number(all.includes("lead") || all.includes("conversion")) * 10 +
      Number(all.includes("testimonial") || all.includes("social proof")) * 10 +
      Number(all.includes("faq")) * 8
  );

  const reliability = clamp(
    5 +
      Number(packageJson?.scripts?.build) * 12 +
      Number(packageJson?.scripts?.dev) * 8 +
      Number(dependencies.react) * 8 +
      Number(dependencies["react-dom"]) * 8 +
      Number(dependencies.vite || packageJson?.devDependencies?.vite) * 8 +
      Number(all.includes("try")) * 8 +
      Number(all.includes("catch")) * 8 +
      Number(all.includes("error")) * 8 +
      Number(all.includes("loading")) * 8 +
      Number(all.includes("empty")) * 8 +
      Number(all.includes("fallback")) * 8 +
      Number(paths.includes("/.env.example")) * 8
  );

  const productDepth = clamp(
    5 +
      Number(appContent.includes("dashboard")) * 10 +
      Number(appContent.includes("project")) * 8 +
      Number(appContent.includes("analytics") || appContent.includes("metric")) * 8 +
      Number(appContent.includes("settings")) * 6 +
      Number(appContent.includes("history")) * 6 +
      Number(appContent.includes("export")) * 6 +
      Number(appContent.includes("deploy")) * 6 +
      Number(appContent.includes("workflow") || appContent.includes("pipeline")) * 8 +
      Number(appContent.includes("automation") || appContent.includes("autopilot")) * 8 +
      Number(appContent.includes("user")) * 6 +
      Number(appContent.includes("team")) * 6 +
      Number(appContent.includes("search") || appContent.includes("filter")) * 8 +
      Number(appContent.includes("game") || appContent.includes("level") || appContent.includes("score")) * 8
  );

  const total = clamp(
    architecture * 0.14 +
      ui * 0.13 +
      mobile * 0.11 +
      performance * 0.08 +
      accessibility * 0.09 +
      seo * 0.08 +
      maintainability * 0.12 +
      monetization * 0.07 +
      reliability * 0.12 +
      productDepth * 0.06
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
    productDepth,
    total,
  };
}

export function buildNextActions(score: any, build: any) {
  const actions: string[] = [];

  if (!build.ok) {
    actions.push("Fix all virtual build issues before adding new features.");
  }

  if (score.architecture < 80) {
    actions.push(
      "Improve architecture: add clear base files, reusable sections, components or structured modules."
    );
  }

  if (score.productDepth < 80) {
    actions.push(
      "Increase product depth: add real workflows, project states, user actions, analytics and settings."
    );
  }

  if (score.ui < 85) {
    actions.push(
      "Upgrade UI to premium level: stronger layout, hierarchy, cards, navigation, states and visual polish."
    );
  }

  if (score.mobile < 85) {
    actions.push(
      "Improve mobile-first responsiveness with better spacing, grids, overflow handling and breakpoints."
    );
  }

  if (score.reliability < 85) {
    actions.push("Improve reliability: add loading, empty, error and fallback states.");
  }

  if (score.accessibility < 80) {
    actions.push(
      "Improve accessibility: semantic HTML, labels, aria attributes, focus states and disabled states."
    );
  }

  if (score.seo < 75) {
    actions.push(
      "Improve SEO: title, meta description, OpenGraph, Twitter card, README, robots and sitemap."
    );
  }

  if (score.monetization < 70) {
    actions.push(
      "Add conversion layer: CTA, pricing, plans, testimonials, FAQ or lead capture."
    );
  }

  if (!actions.length) {
    actions.push(
      "Project is strong. Continue with real user testing, edge cases and deployment polish."
    );
  }

  return actions.slice(0, 8);
}
