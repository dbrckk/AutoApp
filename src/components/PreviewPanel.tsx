import { useMemo } from "react";
import type { VirtualFile } from "../types";

type Props = {
  files: VirtualFile[];
  session?: any;
};

function getFile(files: VirtualFile[], path: string) {
  return files.find((file) => file.path === path || file.path === `/${path}`);
}

function extractBodyFromReactApp(content: string) {
  const titleMatch = content.match(/<h1[^>]*>(.*?)<\/h1>/i);
  const title = titleMatch?.[1] || "Generated App";

  return `
    <main class="app-shell">
      <section class="hero">
        <p class="eyebrow">Generated Preview</p>
        <h1>${title}</h1>
        <p>This is a lightweight static preview. Export or run real build for full React behavior.</p>
        <button>Primary Action</button>
      </section>
    </main>
  `;
}

export function PreviewPanel({ files, session }: Props) {
  const html = useMemo(() => {
    const indexHtml = getFile(files, "/index.html")?.content;
    const appFile =
      getFile(files, "/src/App.tsx")?.content ||
      getFile(files, "/src/App.jsx")?.content ||
      "";

    if (indexHtml?.includes("<body")) return indexHtml;

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      background: #050505;
      color: white;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .app-shell {
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px;
      background:
        radial-gradient(circle at top left, rgba(255,255,255,.16), transparent 32%),
        radial-gradient(circle at bottom right, rgba(255,255,255,.10), transparent 30%),
        #050505;
    }
    .hero {
      width: min(720px, 100%);
      border: 1px solid rgba(255,255,255,.12);
      border-radius: 32px;
      padding: 40px;
      background: rgba(255,255,255,.06);
      box-shadow: 0 24px 80px rgba(0,0,0,.45);
    }
    .eyebrow {
      color: #a1a1aa;
      text-transform: uppercase;
      letter-spacing: .28em;
      font-size: 12px;
    }
    h1 {
      margin: 12px 0;
      font-size: clamp(36px, 7vw, 72px);
      line-height: .95;
      letter-spacing: -0.06em;
    }
    p {
      color: #d4d4d8;
      line-height: 1.7;
    }
    button {
      margin-top: 20px;
      border: 0;
      border-radius: 18px;
      padding: 14px 20px;
      background: white;
      color: black;
      font-weight: 900;
    }
  </style>
</head>
<body>
  ${extractBodyFromReactApp(appFile)}
</body>
</html>`;
  }, [files]);

  if (!files.length && !session?.url) return null;

  return (
    <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] shadow-2xl">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-white">Preview</h2>
          <p className="text-xs text-zinc-500">
            {session?.url ? "Real preview available" : "Static iframe preview"}
          </p>
        </div>

        {session?.url && (
          <a
            href={session.url}
            target="_blank"
            rel="noreferrer"
            className="rounded-2xl bg-white px-4 py-2 text-xs font-bold text-black"
          >
            Open real preview
          </a>
        )}
      </div>

      {session?.url ? (
        <iframe
          title="Real app preview"
          src={session.url}
          className="h-[560px] w-full bg-black"
        />
      ) : (
        <iframe
          title="Generated app preview"
          sandbox="allow-scripts"
          srcDoc={html}
          className="h-[560px] w-full bg-black"
        />
      )}
    </section>
  );
          }
