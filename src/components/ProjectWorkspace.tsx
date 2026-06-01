import type { AutoAppState } from "../hooks/useAutoApp";

import { DiagnosticsPanel } from "./DiagnosticsPanel";
import { FileExplorer } from "./FileExplorer";
import { GitHubHistoryPanel } from "./GitHubHistoryPanel";
import { GitHubPanel } from "./GitHubPanel";
import { JobList } from "./JobList";
import { JobLogsPanel } from "./JobLogsPanel";
import { Panel } from "./Panel";
import { ProjectTabs } from "./ProjectTabs";
import { ProjectToolsPanel } from "./ProjectToolsPanel";
import { ResultPanel } from "./ResultPanel";

export function ProjectWorkspace({
  app,
  activeView,
  onViewChange,
}: {
  app: AutoAppState;
  activeView: string;
  onViewChange: (view: string) => void;
}) {
  return (
    <div className="space-y-5">
      <ProjectTabs activeView={activeView} onViewChange={onViewChange} />

      {activeView === "overview" ? <Overview app={app} onViewChange={onViewChange} /> : null}
      {activeView === "files" ? <FileExplorer app={app} /> : null}
      {activeView === "timeline" ? <Timeline app={app} /> : null}
      {activeView === "release" ? <Release app={app} /> : null}
      {activeView === "github" ? <GitHub app={app} /> : null}
      {activeView === "logs" ? <JobLogsPanel app={app} /> : null}
    </div>
  );
}

function Overview({
  app,
  onViewChange,
}: {
  app: AutoAppState;
  onViewChange: (view: string) => void;
}) {
  const activeJob = app.activeJob;

  return (
    <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
      <Panel title="Active project" subtitle="Focused status instead of a full debug wall.">
        <div className="grid gap-3">
          <div className="rounded-[1.5rem] border border-white/10 bg-black/40 p-4">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-zinc-500">
              Current task
            </p>
            <p className="mt-2 text-lg font-black text-white">
              {app.busy ? "Working…" : activeJob?.phase || "Ready"}
            </p>
            <p className="mt-2 text-sm leading-6 text-zinc-400">{app.status}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Score" value={`${activeJob?.score || 0}/100`} />
            <Stat label="Phase" value={activeJob?.phase || "none"} />
            <Stat label="Attempts" value={`${activeJob?.attempts || 0}/${activeJob?.max_attempts || 0}`} />
            <Stat label="Files" value={String(app.files.length)} />
          </div>

          <div className="grid gap-2 md:grid-cols-4">
            <button className="primary-action" onClick={app.handleStartAutonomous} disabled={app.busy}>
              Start project
            </button>
            <button className="secondary-action" onClick={app.handleStepJob} disabled={app.busy || !app.activeJobId}>
              Run step
            </button>
            <button className="secondary-action" onClick={() => app.handleImproveJob(app.activeJobId)} disabled={app.busy || !app.activeJobId}>
              Improve
            </button>
            <button className="secondary-action" onClick={() => onViewChange("files")}>
              Open files
            </button>
          </div>
        </div>
      </Panel>

      <Panel title="Workspace health" subtitle="What matters before release.">
        <div className="grid gap-3">
          <HealthRow label="GitHub" ok={Boolean(app.githubRepo)} detail={app.githubRepo || "Not configured"} />
          <HealthRow label="Selected file" ok={Boolean(app.selectedFile)} detail={app.selectedFile?.path || "No file selected"} />
          <HealthRow label="Diagnostics" ok={Boolean(app.diagnostics?.ok)} detail={app.diagnostics?.ok ? "API reachable" : "Run diagnostics"} />
          <HealthRow label="Auto-refresh" ok={app.autoRefreshJobs} detail={app.autoRefreshJobs ? "Enabled" : "Disabled"} />
        </div>
      </Panel>

      <div className="xl:col-span-2">
        <JobList app={app} />
      </div>
    </div>
  );
}

function Timeline({ app }: { app: AutoAppState }) {
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_0.85fr]">
      <JobList app={app} />
      <ResultPanel result={app.result || app.diagnostics} />
    </div>
  );
}

function Release({ app }: { app: AutoAppState }) {
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_0.85fr]">
      <ProjectToolsPanel app={app} />
      <DiagnosticsPanel app={app} />
    </div>
  );
}

function GitHub({ app }: { app: AutoAppState }) {
  return (
    <div className="grid gap-5 xl:grid-cols-[0.85fr_1fr]">
      <GitHubPanel app={app} />
      <GitHubHistoryPanel app={app} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] border border-white/10 bg-white/[0.04] p-4">
      <p className="truncate text-lg font-black text-white">{value}</p>
      <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-zinc-600">
        {label}
      </p>
    </div>
  );
}

function HealthRow({
  label,
  ok,
  detail,
}: {
  label: string;
  ok: boolean;
  detail: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/35 p-3">
      <div className="min-w-0">
        <p className="text-xs font-black text-white">{label}</p>
        <p className="mt-1 truncate text-xs text-zinc-500">{detail}</p>
      </div>
      <span
        className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black ${
          ok ? "bg-emerald-500/10 text-emerald-200" : "bg-zinc-700/70 text-zinc-300"
        }`}
      >
        {ok ? "ok" : "todo"}
      </span>
    </div>
  );
}
