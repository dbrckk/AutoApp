import { useMemo, useState } from "react";

import type { AutoAppState } from "../hooks/useAutoApp";
import type { VirtualFile } from "../types";

type PreviewDevice = "mobile" | "tablet" | "desktop";

export function PreviewPanel({
  app,
  files,
  session,
}: {
  app?: AutoAppState;
  files?: VirtualFile[];
  session?: any;
}) {
  const sourceFiles = files || app?.files || [];
  const [device, setDevice] = useState<PreviewDevice>("desktop");
  const [showSource, setShowSource] = useState(false);

  const preview = useMemo(() => {
    return buildPreviewDocument(sourceFiles);
  }, [sourceFiles]);

  const frameClass =
    device === "mobile"
      ? "mx-auto h-[680px] w-[390px] max-w-full"
      : device === "tablet"
      ? "mx-auto h-[760px] w-[768px] max-w-full"
      : "h-[720px] w-full";

  const projectName = getProjectName(sourceFiles);

  return (
    <section className="glass-panel overflow-hidden rounded-[2rem] p-5">
      <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-200">
            Preview
          </p>

          <h2 className="mt-2 text-2xl font-black tracking-tight text-white">
            {projectName}
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Static product preview generated from the current files. Use this to
            verify layout, messaging and visual direction before running a real
            deployment build.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {(["mobile", "tablet", "desktop"] as PreviewDevice[]).map((item) => (
            <button
              key={item}
              onClick={() => setDevice(item)}
              className={`min-h-10 rounded-2xl px-4 text-xs font-black capitalize transition ${
                device === item
                  ? "bg-white text-black"
                  : "border border-white/10 bg-white/[0.05] text-slate-300 hover:bg-white/[0.08]"
              }`}
            >
              {item}
            </button>
          ))}

          <button
            onClick={() => setShowSource((value) => !value)}
            className="min-h-10 rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-xs font-black text-white transition hover:bg-white/[0.08]"
          >
            {showSource ? "Hide source" : "Source"}
          </button>

          {app ? (
            <button
              onClick={app.handleExportZip}
              disabled={app.busy || !sourceFiles.length}
              className="min-h-10 rounded-2xl border border-cyan-400/25 bg-cyan-500/10 px-4 text-xs font-black text-cyan-200 transition hover:bg-cyan-500/20 disabled:opacity-50"
            >
              Export ZIP
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-[2rem] border border-white/10 bg-black/35 p-3">
          <div className="mb-3 flex items-center justify-between gap-3 px-2">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-red-400/80" />
              <span className="h-3 w-3 rounded-full bg-yellow-300/80" />
              <span className="h-3 w-3 rounded-full bg-emerald-400/80" />
            </div>

            <p className="truncate rounded-full bg-white/[0.06] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
              Static preview - {device}
            </p>
          </div>

          <div className={`${frameClass} overflow-hidden rounded-[1.4rem] border border-white/10 bg-white`}>
            <iframe
              title="AutoApp generated preview"
              sandbox="allow-scripts"
              srcDoc={preview.html}
              className="h-full w-full border-0 bg-white"
            />
          </div>
        </div>

        <aside className="space-y-4">
          <PreviewStat label="Files" value={sourceFiles.length} />
          <PreviewStat label="Components" value={preview.componentCount} />
          <PreviewStat label="Detected screens" value={preview.screenCount} />
          <PreviewStat label="Preview confidence" value={`${preview.confidence}/100`} />

          <div className="rounded-3xl border border-white/10 bg-black/25 p-4">
            <p className="text-sm font-black text-white">Detected product</p>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              {preview.summary}
            </p>
          </div>

          {session ? (
            <div className="rounded-3xl border border-white/10 bg-black/25 p-4">
              <p className="text-sm font-black text-white">Preview session</p>
              <pre className="mt-3 max-h-[220px] overflow-auto whitespace-pre-wrap text-xs leading-5 text-slate-400">
                {safeJson(session)}
              </pre>
            </div>
          ) : null}
        </aside>
      </div>

      {showSource ? (
        <details open className="mt-5 rounded-3xl border border-white/10 bg-black/25 p-4">
          <summary className="cursor-pointer text-sm font-black text-white">
            Generated preview HTML
          </summary>

          <pre className="mt-4 max-h-[420px] overflow-auto whitespace-pre-wrap rounded-2xl bg-black/35 p-4 text-xs leading-5 text-slate-300">
            {preview.html}
          </pre>
        </details>
      ) : null}
    </section>
  );
}

function PreviewStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="soft-card rounded-2xl p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
    </div>
  );
}

function buildPreviewDocument(files: VirtualFile[]) {
  const appFile =
    findFile(files, "/src/App.tsx") ||
    findFile(files, "src/App.tsx") ||
    files.find((file) => file.path.endsWith("App.jsx")) ||
    null;

  const cssFile =
    findFile(files, "/src/index.css") ||
    findFile(files, "src/index.css") ||
    files.find((file) => file.path.endsWith(".css")) ||
    null;

  const allContent = files.map((file) => file.content || "").join("\n");
  const componentCount = files.filter((file) =>
    /src\/components\/.+\.(tsx|jsx)$/i.test(file.path)
  ).length;

  const screens = extractScreens(allContent);
  const title = extractTitle(appFile?.content || allContent);
  const subtitle = extractSubtitle(appFile?.content || allContent);
  const actions = extractActions(appFile?.content || allContent);
  const metrics = extractMetrics(allContent);
  const cards = extractCards(allContent);

  const confidence = Math.min(
    100,
    35 +
      (appFile ? 20 : 0) +
      (cssFile ? 10 : 0) +
      Math.min(20, componentCount * 2) +
      Math.min(15, screens.length * 5)
  );

  const html = createHtml({
    title,
    subtitle,
    actions,
    metrics,
    cards,
    screens,
    css: cssFile?.content || "",
  });

  return {
    html,
    componentCount,
    screenCount: screens.length,
    confidence,
    summary:
      screens.length > 0
        ? `Detected ${screens.length} screen area(s): ${screens.join(", ")}.`
        : "Generic app shell detected from current React files.",
  };
}

function createHtml(input: {
  title: string;
  subtitle: string;
  actions: string[];
  metrics: string[];
  cards: string[];
  screens: string[];
  css: string;
}) {
  const actions = (input.actions.length ? input.actions : ["Get Started", "View Dashboard"])
    .slice(0, 3)
    .map((action, index) => `<button class="${index === 0 ? "primary" : "secondary"}">${escapeHtml(action)}</button>`)
    .join("");

  const metrics = (input.metrics.length ? input.metrics : ["Build 100", "UX 92", "Mobile 96", "Quality 94"])
    .slice(0, 4)
    .map((metric) => {
      const parts = metric.split(/\s+/);
      const value = parts.find((part) => /\d+/.test(part)) || "92";
      const label = metric.replace(value, "").trim() || "Metric";
      return `<article class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></article>`;
    })
    .join("");

  const cards = (input.cards.length ? input.cards : [
    "Autonomous project generation",
    "Professional quality gate",
    "Company Brain memory",
    "Live Workspace refactor plan",
  ])
    .slice(0, 6)
    .map((card) => `<article class="card"><h3>${escapeHtml(card)}</h3><p>Production-ready workflow with mobile-first interface and resilient states.</p></article>`)
    .join("");

  const screens = (input.screens.length ? input.screens : ["Dashboard", "Projects", "Settings"])
    .slice(0, 6)
    .map((screen) => `<span>${escapeHtml(screen)}</span>`)
    .join("");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <style>
    :root {
      color-scheme: dark;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #05070c;
      color: white;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      min-height: 100vh;
      background:
        radial-gradient(circle at 20% 0%, rgba(124,92,255,.28), transparent 34rem),
        radial-gradient(circle at 90% 10%, rgba(76,201,255,.16), transparent 30rem),
        linear-gradient(180deg, #05070c, #080d1a 55%, #05070c);
    }

    main {
      min-height: 100vh;
      padding: clamp(20px, 4vw, 56px);
    }

    .shell {
      max-width: 1180px;
      margin: 0 auto;
    }

    .nav {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 54px;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      font-weight: 950;
      letter-spacing: -.04em;
    }

    .logo {
      display: grid;
      place-items: center;
      width: 42px;
      height: 42px;
      border-radius: 16px;
      background: linear-gradient(135deg, #7c5cff, #4cc9ff);
      box-shadow: 0 0 50px rgba(124,92,255,.45);
    }

    .screens {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .screens span {
      border: 1px solid rgba(255,255,255,.1);
      background: rgba(255,255,255,.045);
      border-radius: 999px;
      padding: 8px 12px;
      color: #cbd5e1;
      font-size: 12px;
      font-weight: 800;
    }

    .hero {
      display: grid;
      gap: 28px;
      grid-template-columns: minmax(0, 1.1fr) minmax(320px, .9fr);
      align-items: center;
    }

    .eyebrow {
      display: inline-flex;
      width: fit-content;
      border: 1px solid rgba(124,92,255,.26);
      background: rgba(124,92,255,.12);
      color: #dcd6ff;
      border-radius: 999px;
      padding: 8px 12px;
      font-size: 11px;
      font-weight: 950;
      text-transform: uppercase;
      letter-spacing: .18em;
    }

    h1 {
      margin: 18px 0 0;
      max-width: 820px;
      font-size: clamp(40px, 7vw, 84px);
      line-height: .92;
      letter-spacing: -.075em;
    }

    .subtitle {
      max-width: 660px;
      margin: 24px 0 0;
      color: #94a3b8;
      font-size: 17px;
      line-height: 1.7;
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 30px;
    }

    button {
      min-height: 48px;
      border: 0;
      border-radius: 18px;
      padding: 0 18px;
      font-weight: 950;
      cursor: pointer;
    }

    .primary {
      background: white;
      color: black;
      box-shadow: 0 18px 70px rgba(255,255,255,.18);
    }

    .secondary {
      border: 1px solid rgba(255,255,255,.12);
      background: rgba(255,255,255,.055);
      color: white;
    }

    .panel {
      border: 1px solid rgba(255,255,255,.10);
      background: linear-gradient(180deg, rgba(255,255,255,.075), rgba(255,255,255,.035));
      border-radius: 32px;
      padding: 20px;
      box-shadow: 0 30px 120px rgba(0,0,0,.35);
      backdrop-filter: blur(20px);
    }

    .metrics {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }

    .metric, .card {
      border: 1px solid rgba(255,255,255,.08);
      background: rgba(0,0,0,.24);
      border-radius: 24px;
      padding: 18px;
    }

    .metric span {
      display: block;
      color: #64748b;
      font-size: 11px;
      font-weight: 950;
      text-transform: uppercase;
      letter-spacing: .16em;
    }

    .metric strong {
      display: block;
      margin-top: 10px;
      font-size: 34px;
      letter-spacing: -.05em;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px;
      margin-top: 28px;
    }

    .card h3 {
      margin: 0;
      font-size: 16px;
      letter-spacing: -.03em;
    }

    .card p {
      margin: 10px 0 0;
      color: #94a3b8;
      font-size: 13px;
      line-height: 1.6;
    }

    @media (max-width: 860px) {
      .hero { grid-template-columns: 1fr; }
      .grid { grid-template-columns: 1fr; }
      .screens { display: none; }
      main { padding: 22px; }
    }

    ${input.css ? "/* Project CSS detected and partially ignored for preview safety. */" : ""}
  </style>
</head>
<body>
  <main>
    <div class="shell">
      <nav class="nav">
        <div class="brand"><div class="logo">A</div><span>${escapeHtml(input.title)}</span></div>
        <div class="screens">${screens}</div>
      </nav>

      <section class="hero">
        <div>
          <div class="eyebrow">Generated Product Preview</div>
          <h1>${escapeHtml(input.title)}</h1>
          <p class="subtitle">${escapeHtml(input.subtitle)}</p>
          <div class="actions">${actions}</div>
        </div>

        <div class="panel">
          <div class="metrics">${metrics}</div>
        </div>
      </section>

      <section class="grid">${cards}</section>
    </div>
  </main>
</body>
</html>`;
}

function extractTitle(content: string) {
  const title =
    matchFirst(content, [
      /<h1[^>]*>(.*?)<\/h1>/is,
      /title\s*[:=]\s*["'`]([^"'`]{3,80})["'`]/i,
      /productName\s*[:=]\s*["'`]([^"'`]{3,80})["'`]/i,
      /name\s*[:=]\s*["'`]([^"'`]{3,80})["'`]/i,
    ]) || "AutoApp Product";

  return stripJsx(title);
}

function extractSubtitle(content: string) {
  const subtitle =
    matchFirst(content, [
      /<p[^>]*>(.*?)<\/p>/is,
      /subtitle\s*[:=]\s*["'`]([^"'`]{10,220})["'`]/i,
      /description\s*[:=]\s*["'`]([^"'`]{10,220})["'`]/i,
    ]) ||
    "A polished mobile-first product generated by AutoApp with professional structure, quality checks and autonomous improvement.";

  return stripJsx(subtitle);
}

function extractActions(content: string) {
  const actions = Array.from(content.matchAll(/<button[^>]*>(.*?)<\/button>/gis))
    .map((match) => stripJsx(match[1]))
    .filter(Boolean);

  return Array.from(new Set(actions)).slice(0, 6);
}

function extractMetrics(content: string) {
  const metrics = Array.from(
    content.matchAll(/(?:label|title)\s*:\s*["'`]([^"'`]{2,40})["'`][\s\S]{0,120}(?:value|score)\s*:\s*(\d{1,3})/gi)
  ).map((match) => `${match[1]} ${match[2]}`);

  return Array.from(new Set(metrics)).slice(0, 8);
}

function extractCards(content: string) {
  const headings = Array.from(content.matchAll(/<h[23][^>]*>(.*?)<\/h[23]>/gis))
    .map((match) => stripJsx(match[1]))
    .filter((value) => value.length > 2);

  return Array.from(new Set(headings)).slice(0, 8);
}

function extractScreens(content: string) {
  const candidates = [
    "Dashboard",
    "Projects",
    "Analytics",
    "Settings",
    "Onboarding",
    "Reports",
    "Workspace",
    "GitHub",
    "Build",
    "Preview",
    "Brain",
    "Quality",
  ];

  return candidates.filter((candidate) =>
    new RegExp(candidate, "i").test(content)
  );
}

function findFile(files: VirtualFile[], path: string) {
  return files.find((file) => file.path === path || file.path === `/${path}`);
}

function getProjectName(files: VirtualFile[]) {
  const packageFile = findFile(files, "/package.json") || findFile(files, "package.json");

  if (packageFile?.content) {
    try {
      const json = JSON.parse(packageFile.content);
      if (json?.name) return String(json.name);
    } catch {
      return extractTitle(files.map((file) => file.content || "").join("\n"));
    }
  }

  return extractTitle(files.map((file) => file.content || "").join("\n"));
}

function matchFirst(value: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match?.[1]) return match[1];
  }

  return "";
}

function stripJsx(value: string) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/[{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(value: string) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function safeJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
