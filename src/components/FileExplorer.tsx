import type { AutoAppState } from "../hooks/useAutoApp";

import { Panel } from "./Panel";
import { CodeEditor } from "./CodeEditor";

export function FileExplorer({ app }: { app: AutoAppState }) {
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
    <Panel title={`Files (${app.files.length})`}>
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <div className="max-h-[620px] overflow-auto rounded-2xl border border-white/10 bg-black/40 p-2">
          {app.files.length ? (
            app.files.map((file) => (
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
            <p className="p-3 text-sm text-zinc-500">No files yet.</p>
          )}
        </div>

        <CodeEditor
          file={app.selectedFile}
          onChange={updateCurrentFile}
        />
      </div>
    </Panel>
  );
                }
