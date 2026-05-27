import { useMemo, useState } from "react";

import type { AutoAppState } from "../hooks/useAutoApp";

import { Panel } from "./Panel";
import { CodeEditor } from "./CodeEditor";

export function FileExplorer({ app }: { app: AutoAppState }) {
  const [query, setQuery] = useState("");

  const filteredFiles = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (!q) return app.files;

    return app.files.filter((file) =>
      `${file.path}\n${file.content || ""}`.toLowerCase().includes(q)
    );
  }, [app.files, query]);

  const stats = useMemo(() => {
    const totalChars = app.files.reduce(
      (sum, file) => sum + String(file.content || "").length,
      0
    );

    const totalLines = app.files.reduce(
      (sum, file) => sum + String(file.content || "").split("\n").length,
      0
    );

    return {
      files: app.files.length,
      lines: totalLines,
      chars: totalChars,
    };
  }, [app.files]);

  function updateCurrentFile(content: string) {
    if (!app.selectedFile) return;

    app.setFiles((previous) =>
      previous.map((file) =>
        file.path === app.selectedFile?.path
          ? {
              ...file,
              content,
            }
          : file
      )
    );
  }

  return (
    <Panel
      title={`Files (${app.files.length})`}
      subtitle={`${stats.lines} lines · ${stats.chars.toLocaleString()} chars`}
    >
      <div className="mb-4 grid gap-3 md:grid-cols-[1fr_auto]">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search files..."
          className="rounded-2xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white outline-none focus:border-white/30"
        />

        <button
          onClick={() => setQuery("")}
          className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold text-white hover:bg-white/10"
        >
          Clear
        </button>
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <button
          onClick={app.handleCreateFile}
          className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold text-white hover:bg-white/10"
        >
          New file
        </button>

        <button
          onClick={app.handleRenameSelectedFile}
          disabled={!app.selectedFile}
          className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold text-white hover:bg-white/10 disabled:opacity-50"
        >
          Rename
        </button>

        <button
          onClick={app.handleDeleteSelectedFile}
          disabled={!app.selectedFile}
          className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200 hover:bg-red-500/20 disabled:opacity-50"
        >
          Delete
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <div className="max-h-[620px] overflow-auto rounded-2xl border border-white/10 bg-black/40 p-2">
          {filteredFiles.length ? (
            filteredFiles.map((file) => (
              <button
                key={file.path}
                onClick={() => app.setSelectedPath(file.path)}
                className={`mb-1 block w-full rounded-xl px-3 py-2 text-left text-xs transition ${
                  app.selectedFile?.path === file.path
                    ? "bg-white text-black"
                    : "text-zinc-300 hover:bg-white/10"
                }`}
              >
                {file.path}
              </button>
            ))
          ) : (
            <p className="p-3 text-sm text-zinc-500">No matching files.</p>
          )}
        </div>

        <CodeEditor file={app.selectedFile} onChange={updateCurrentFile} />
      </div>
    </Panel>
  );
      }
