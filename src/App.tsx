import { useAutoApp } from "./hooks/useAutoApp";

import { PromptPanel } from "./components/PromptPanel";
import { GitHubPanel } from "./components/GitHubPanel";
import { DiagnosticsPanel } from "./components/DiagnosticsPanel";
import { ProjectToolsPanel } from "./components/ProjectToolsPanel";
import { SnapshotsPanel } from "./components/SnapshotsPanel";
import { JobList } from "./components/JobList";
import { FileExplorer } from "./components/FileExplorer";
import { ResultPanel } from "./components/ResultPanel";
import { Panel } from "./components/Panel";
import { FileActionModal } from "./components/FileActionModal";

export default function App() {
  const app = useAutoApp();

  return (
    <main className="min-h-screen bg-[#050505] px-4 py-6 text-white md:px-8">
      <section className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[430px_1fr]">
        <aside className="space-y-5">
          <PromptPanel app={app} />
          <GitHubPanel app={app} />
          <DiagnosticsPanel app={app} />
          <ProjectToolsPanel app={app} />
          <SnapshotsPanel app={app} />
        </aside>

        <section className="space-y-5">
          <Panel title="Status">
            <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
              <p className="text-sm text-zinc-300">
                {app.busy ? "Working..." : app.status}
              </p>

              {app.activeJobId ? (
                <p className="mt-2 break-all text-xs text-zinc-500">
                  Active job: {app.activeJobId}
                </p>
              ) : null}
            </div>
          </Panel>

          <JobList app={app} />
          <FileExplorer app={app} />
          <ResultPanel result={app.result || app.diagnostics} />
        </section>
      </section>

      <FileActionModal
        mode={app.fileActionMode}
        value={app.fileActionValue}
        onChange={app.setFileActionValue}
        onCancel={app.handleCancelFileAction}
        onConfirm={app.handleConfirmFileAction}
      />
    </main>
  );
}
