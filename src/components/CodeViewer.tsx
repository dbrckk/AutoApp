import { lazy, Suspense } from "react";
import type { VirtualFile } from "../types";

const SyntaxHighlighter = lazy(async () => {
  const mod = await import("react-syntax-highlighter");
  return { default: mod.Prism };
});

const syntaxThemePromise = import(
  "react-syntax-highlighter/dist/esm/styles/prism"
);

type Props = {
  file?: VirtualFile;
};

function getLanguage(path = "") {
  if (path.endsWith(".tsx") || path.endsWith(".jsx")) return "tsx";
  if (path.endsWith(".ts")) return "typescript";
  if (path.endsWith(".js")) return "javascript";
  if (path.endsWith(".json")) return "json";
  if (path.endsWith(".css")) return "css";
  if (path.endsWith(".html")) return "html";
  if (path.endsWith(".md")) return "markdown";
  if (path.endsWith(".yml") || path.endsWith(".yaml")) return "yaml";
  if (path.endsWith(".sql")) return "sql";
  if (path.endsWith(".sh")) return "bash";
  return "text";
}

let cachedTheme: any = null;

async function loadTheme() {
  if (cachedTheme) return cachedTheme;
  const themeModule = await syntaxThemePromise;
  cachedTheme = themeModule.oneDark;
  return cachedTheme;
}

export function CodeViewer({ file }: Props) {
  if (!file) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-sm text-zinc-500">
        No file selected.
      </div>
    );
  }

  if (!file.content) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-sm text-zinc-500">
        Empty file.
      </div>
    );
  }

  return (
    <Suspense
      fallback={
        <pre className="min-h-full overflow-auto bg-black/40 p-4 font-mono text-xs leading-relaxed text-zinc-300">
          {file.content}
        </pre>
      }
    >
      <LazyHighlightedCode
        path={file.path}
        content={file.content}
      />
    </Suspense>
  );
}

function LazyHighlightedCode({
  path,
  content,
}: {
  path: string;
  content: string;
}) {
  const language = getLanguage(path);

  return (
    <AsyncThemeHighlighter
      language={language}
      content={content}
    />
  );
}

function AsyncThemeHighlighter({
  language,
  content,
}: {
  language: string;
  content: string;
}) {
  const themeResource = useThemeResource();

  return (
    <SyntaxHighlighter
      language={language}
      style={themeResource}
      customStyle={{
        margin: 0,
        minHeight: "100%",
        background: "transparent",
        fontSize: "12px",
        lineHeight: "1.7",
      }}
      wrapLongLines
      showLineNumbers
    >
      {content}
    </SyntaxHighlighter>
  );
}

function useThemeResource() {
  if (cachedTheme) return cachedTheme;

  throw loadTheme();
}
