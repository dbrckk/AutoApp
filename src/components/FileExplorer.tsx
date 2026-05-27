import type { AutoAppState } from "../hooks/useAutoApp";
import { Panel } from "./Panel";

export function FileExplorer({ app }: { app: AutoAppState }) {
  return (
    <Panel title={`Files (${app.files.length})`}>
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="max-h-[560px] overflow-auto rounded-2xl border border-white/10 bg-black/40 p-2">
          {app.files.length ? (
            app.files.map((file) => (
              <button
                key={file.path}
                onClick={() => app.setSelectedPath(file.path)}
                className={`block w-full rounded-xl px-3 py-2 text-left text-xs transition ${
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

        <pre className="max-h-[560px] overflow-auto rounded-2xl border border-white/10 bg-black/60 p-4 text-xs leading-5 text-zinc-300">
          {app.selectedFile?.content || "No file selected."}
        </pre>
      </div>
    </Panel>
  );
}
