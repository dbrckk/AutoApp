import { Check, Copy } from "lucide-react";
import { useEffect, useState, type ComponentType } from "react";
import type { VirtualFile } from "../types";

type CodeViewerProps = {
  file?: VirtualFile | null;
};

type SyntaxHighlighterProps = {
  language: string;
  style: unknown;
  customStyle?: Record<string, unknown>;
  lineNumberStyle?: Record<string, unknown>;
  showLineNumbers?: boolean;
  wrapLongLines?: boolean;
  children: string;
};

let cachedHighlighter: ComponentType<SyntaxHighlighterProps> | null = null;
let cachedTheme: unknown = null;
let loadingPromise: Promise<void> | null = null;

function getLanguage(path = "") {
  if (path.endsWith(".tsx")) return "tsx";
  if (path.endsWith(".ts")) return "typescript";
  if (path.endsWith(".jsx")) return "jsx";
  if (path.endsWith(".js")) return "javascript";
  if (path.endsWith(".css")) return "css";
  if (path.endsWith(".json")) return "json";
  if (path.endsWith(".html")) return "markup";
  if (path.endsWith(".md")) return "markdown";
  if (path.endsWith(".yml") || path.endsWith(".yaml")) return "yaml";
  if (path.endsWith(".sh")) return "bash";
  return "text";
}

function loadSyntaxHighlighter() {
  if (cachedHighlighter && cachedTheme) return Promise.resolve();

  if (!loadingPromise) {
    loadingPromise = Promise.all([
      import("react-syntax-highlighter/dist/esm/prism-light"),
      import("react-syntax-highlighter/dist/esm/styles/prism/vsc-dark-plus"),
      import("react-syntax-highlighter/dist/esm/languages/prism/typescript"),
      import("react-syntax-highlighter/dist/esm/languages/prism/tsx"),
      import("react-syntax-highlighter/dist/esm/languages/prism/javascript"),
      import("react-syntax-highlighter/dist/esm/languages/prism/jsx"),
      import("react-syntax-highlighter/dist/esm/languages/prism/css"),
      import("react-syntax-highlighter/dist/esm/languages/prism/json"),
      import("react-syntax-highlighter/dist/esm/languages/prism/markup"),
      import("react-syntax-highlighter/dist/esm/languages/prism/markdown"),
      import("react-syntax-highlighter/dist/esm/languages/prism/yaml"),
      import("react-syntax-highlighter/dist/esm/languages/prism/bash"),
    ]).then(
      ([
        highlighterModule,
        themeModule,
        typescript,
        tsx,
        javascript,
        jsx,
        css,
        json,
        markup,
        markdown,
        yaml,
        bash,
      ]) => {
        const PrismLight = highlighterModule.default;

        PrismLight.registerLanguage("typescript", typescript.default);
        PrismLight.registerLanguage("tsx", tsx.default);
        PrismLight.registerLanguage("javascript", javascript.default);
        PrismLight.registerLanguage("jsx", jsx.default);
        PrismLight.registerLanguage("css", css.default);
        PrismLight.registerLanguage("json", json.default);
        PrismLight.registerLanguage("markup", markup.default);
        PrismLight.registerLanguage("markdown", markdown.default);
        PrismLight.registerLanguage("yaml", yaml.default);
        PrismLight.registerLanguage("bash", bash.default);

        cachedHighlighter = PrismLight as unknown as ComponentType<SyntaxHighlighterProps>;
        cachedTheme = themeModule.default;
      }
    );
  }

  return loadingPromise;
}

export function CodeViewer({ file }: CodeViewerProps) {
  const [copied, setCopied] = useState(false);
  const [ready, setReady] = useState(Boolean(cachedHighlighter && cachedTheme));

  useEffect(() => {
    let alive = true;

    loadSyntaxHighlighter()
      .then(() => {
        if (alive) setReady(true);
      })
      .catch(() => {
        if (alive) setReady(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  if (!file) {
    return (
      <div className="flex h-full flex-1 flex-col items-center justify-center overflow-hidden bg-[#050505] text-gray-400">
        <div className="z-10 flex flex-col items-center px-6 text-center">
          <div className="mb-8 flex h-28 w-28 items-center justify-center rounded-[2.5rem] border border-white/5 bg-gradient-to-tr from-pink-500/10 via-purple-500/10 to-indigo-500/10 shadow-[0_0_50px_rgba(236,72,153,0.1)] backdrop-blur-xl">
            <svg
              className="h-12 w-12 text-pink-400/80 drop-shadow-[0_0_10px_rgba(236,72,153,0.5)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
                d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
              />
            </svg>
          </div>

          <p className="bg-gradient-to-r from-gray-300 to-gray-500 bg-clip-text text-[11px] font-black uppercase tracking-[0.3em] text-transparent">
            Forge AI Workspace
          </p>

          <p className="mt-4 max-w-sm font-mono text-xs leading-relaxed text-gray-500">
            Select a file from the explorer to view its source.
          </p>
        </div>
      </div>
    );
  }

  const content = file.content || "// Empty file";
  const isImagePlaceholder = content.startsWith("https://image.pollinations.ai/");

  function handleCopy() {
    navigator.clipboard.writeText(content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  const Highlighter = cachedHighlighter;

  return (
    <div className="group relative flex h-full flex-1 flex-col overflow-hidden bg-[#050505]">
      <div className="z-20 flex h-14 shrink-0 items-center overflow-x-auto border-b border-white/5 bg-gradient-to-b from-[#111] to-[#0a0a0a] px-5 shadow-md">
        <div className="flex items-center font-mono text-[11px] uppercase tracking-widest text-gray-400">
          <span className="mr-3 h-2 w-2 rounded-full bg-pink-500 shadow-[0_0_8px_rgba(236,72,153,0.8)]" />
          <span className="rounded-lg border border-white/5 bg-white/5 px-3 py-1.5 shadow-inner">
            {file.path}
          </span>
        </div>
      </div>

      {!isImagePlaceholder && (
        <button
          type="button"
          onClick={handleCopy}
          className="absolute right-6 top-16 z-30 rounded-xl border border-white/10 bg-[#1a1a1a]/80 p-2.5 text-gray-400 opacity-0 shadow-xl backdrop-blur-md transition-all hover:scale-110 hover:border-pink-500/50 hover:bg-pink-500/20 hover:text-pink-300 group-hover:opacity-100 active:scale-95"
          title="Copy Code"
        >
          {copied ? (
            <Check className="h-4 w-4 text-emerald-400" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </button>
      )}

      <div className="relative flex-1 overflow-auto">
        {isImagePlaceholder ? (
          <div className="flex h-full items-center justify-center p-8">
            <img
              src={content}
              alt={file.path}
              className="max-h-full max-w-full rounded-2xl border border-white/10 object-contain shadow-2xl"
            />
          </div>
        ) : ready && Highlighter && cachedTheme ? (
          <Highlighter
            language={getLanguage(file.path)}
            style={cachedTheme}
            customStyle={{
              margin: 0,
              padding: "2.5rem 2rem",
              minHeight: "100%",
              fontSize: "13.5px",
              lineHeight: "1.7",
              backgroundColor: "transparent",
            }}
            lineNumberStyle={{
              minWidth: "3.5em",
              paddingRight: "2em",
              color: "#333",
              textAlign: "right",
              fontSize: "12px",
            }}
            showLineNumbers
            wrapLongLines
          >
            {content}
          </Highlighter>
        ) : (
          <pre className="min-h-full overflow-auto bg-transparent p-8 font-mono text-xs leading-relaxed text-zinc-300">
            {content}
          </pre>
        )}
      </div>
    </div>
  );
}
