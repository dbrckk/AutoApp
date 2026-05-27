import Editor from "@monaco-editor/react";

import type { VirtualFile } from "../types";

export function CodeEditor({
  file,
  onChange,
}: {
  file: VirtualFile | null;
  onChange?: (value: string) => void;
}) {
  const language = detectLanguage(file?.path || "");

  return (
    <div className="h-[620px] overflow-hidden rounded-2xl border border-white/10">
      <Editor
        height="100%"
        theme="vs-dark"
        language={language}
        value={file?.content || ""}
        onChange={(value) => onChange?.(value || "")}
        options={{
          fontSize: 13,
          minimap: {
            enabled: false,
          },
          smoothScrolling: true,
          automaticLayout: true,
          wordWrap: "on",
          scrollBeyondLastLine: false,
          roundedSelection: true,
          padding: {
            top: 14,
          },
          scrollbar: {
            verticalScrollbarSize: 10,
            horizontalScrollbarSize: 10,
          },
        }}
      />
    </div>
  );
}

function detectLanguage(path: string) {
  if (path.endsWith(".ts")) return "typescript";
  if (path.endsWith(".tsx")) return "typescript";
  if (path.endsWith(".js")) return "javascript";
  if (path.endsWith(".jsx")) return "javascript";
  if (path.endsWith(".json")) return "json";
  if (path.endsWith(".css")) return "css";
  if (path.endsWith(".html")) return "html";
  if (path.endsWith(".md")) return "markdown";
  if (path.endsWith(".py")) return "python";
  if (path.endsWith(".sql")) return "sql";
  if (path.endsWith(".yaml")) return "yaml";
  if (path.endsWith(".yml")) return "yaml";

  return "plaintext";
}
