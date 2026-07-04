import { useEffect, useMemo, useState } from "react";
import { useAutoApp } from "./hooks/useAutoApp";
import { ProjectsPanel } from "./components/ProjectsPanel";
import { FileExplorer } from "./components/FileExplorer";
import { GitHubHistoryPanel } from "./components/GitHubHistoryPanel";
import { JobLogsPanel } from "./components/JobLogsPanel";
import { NotificationCenter } from "./components/NotificationCenter";
import { PipelinePanel } from "./components/PipelinePanel";
import { PreflightPanel } from "./components/PreflightPanel";
import { RuntimeBanner } from "./components/RuntimeBanner";
import { SessionRecoveryPanel } from "./components/SessionRecoveryPanel";
import { ConfirmModal } from "./components/ConfirmModal";
import { FileActionModal } from "./components/FileActionModal";
import {
  clearFrontendSnapshot,
  isFreshSnapshot,
  readFrontendSnapshot,
  saveFrontendSnapshot,
  type FrontendSessionSnapshot,
} from "./lib/sessionStore";

type WorkspaceTab = "overview" | "files" | "timeline" | "logs" | "github" | "settings";
const UI_PREFS_KEY = "autoapp.ui.preferences.v2";
const NAV: { id: WorkspaceTab; label: string; icon: string }[] = [
  { id: "overview", label: "Command", icon: "CO" },
  { id: "files", label: "Files", icon: "FL" },
  { id: "timeline", label: "Monitor", icon: "MO" },
  { id: "logs", label: "Logs", icon: "LG" },
  { id: "github", label: "GitHub", icon: "GH" },
  { id: "settings", label: "Release", icon: "RL" },
];

export default function App() {
  const app = useAutoApp();
  const [tab, setTab] = useState<WorkspaceTab>("overview");
  const [hydrated, setHydrated] = useState(false);
  const [recoverySnapshot, setRecoverySnapshot] = useState<FrontendSessionSnapshot | null>(null);
  const activeScore = Number(app.activeJob?.score || app.projectReport?.score?.total || 0);
  const health = useMemo(() => app.activeJob?.status || "No active project", [app.activeJob]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(UI_PREFS_KEY) || "{}");
      if (typeof saved.prompt === "string") app.setPrompt(saved.prompt);
      if (typeof saved.githubRepo === "string") app.setGithubRepo(saved.githubRepo);
      if (typeof saved.githubBranch === "string") app.setGithubBranch(saved.githubBranch);
      if (NAV.some((item) => item.id === saved.tab)) setTab(saved.tab);
    } catch {}

    const snapshot = readFrontendSnapshot();
    if (isFreshSnapshot(snapshot) && (snapshot?.activeJobId || snapshot?.files.length)) {
      setRecoverySnapshot(snapshot);
    }

    setHydrated(true);
    void app.handleDiagnostics();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(UI_PREFS_KEY, JSON.stringify({ prompt: app.prompt, githubRepo: app.githubRepo, githubBranch: app.githubBranch, tab }));
    } catch {}
  }, [hydrated, app.prompt, app.githubRepo, app.githubBranch, tab]);

  useEffect(() => {
    if (!hydrated || recoverySnapshot) return;
    const timer = window.setTimeout(() => {
      saveFrontendSnapshot({
        activeJobId: app.activeJobId,
        selectedPath: app.selectedPath,
        files: app.files,
        projectReport: app.projectReport,
        jobLogs: app.jobLogs,
      });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [hydrated, recoverySnapshot, app.activeJobId, app.selectedPath, app.files, app.projectReport, app.jobLogs]);

  useEffect(() => {
    const syncVisibility = () => {
      const visible = document.visibilityState === "visible";
      app.setAutoRefreshJobs(visible);
      if (!visible) return;

      app.refreshJobs().catch(() => undefined);
      if (app.activeJobId) {
        app.refreshJobFiles(app.activeJobId).catch(() => undefined);
        app.refreshJobLogs(app.activeJobId).catch(() => undefined);
        app.refreshProjectReport(app.activeJobId).catch(() => undefined);
      }
    };

    document.addEventListener("visibilitychange", syncVisibility);
    window.addEventListener("online", syncVisibility);
    syncVisibility();
    return () => {
      document.removeEventListener("visibilitychange", syncVisibility);
      window.removeEventListener("online", syncVisibility);
    };
  }, [app.activeJobId]);

  function restoreRecoverySnapshot() {
    if (!recoverySnapshot) return;
    app.setActiveJobId(recoverySnapshot.activeJobId);
    app.setFiles(recoverySnapshot.files);
    app.setSelectedPath(recoverySnapshot.selectedPath || recoverySnapshot.files[0]?.path || "");
    clearFrontendSnapshot();
    setRecoverySnapshot(null);

    if (recoverySnapshot.activeJobId) {
      void Promise.allSettled([
        app.refreshJobs(),
        app.refreshJobFiles(recoverySnapshot.activeJobId),
        app.refreshJobLogs(recoverySnapshot.activeJobId),
        app.refreshProjectReport(recoverySnapshot.activeJobId),
      ]);
    }
  }

  function dismissRecoverySnapshot() {
    clearFrontendSnapshot();
    setRecoverySnapshot(null);
  }

  const recoveryApp = {
    ...app,
    sessionSnapshotAvailable: Boolean(recoverySnapshot),
    restoreFrontendSnapshot: restoreRecoverySnapshot,
    dismissFrontendSnapshot: dismissRecoverySnapshot,
  };

  return (
    <main className="app-bg text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-[1540px] gap-0 px-3 py-3 lg:px-4">
        <aside className="hidden w-[260px] shrink-0 flex-col border-r border-white/10 pr-3 lg:flex">
          <Brand />
          <button onClick={app.handleStartAutonomous} disabled={app.busy} className="neon-button mt-6 min-h-12 rounded-2xl px-4 text-sm font-black text-white disabled:opacity-50">+ New Project</button>
          <nav className="mt-6 grid gap-1">{NAV.map((item) => <button key={item.id} onClick={() => setTab(item.id)} className={`flex min-h-12 items-center gap-3 rounded-2xl px-4 text-left text-sm transition ${tab === item.id ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/6 hover:text-white"}`}><span className="grid h-7 w-7 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-[10px] font-black">{item.icon}</span><span className="font-bold">{item.label}</span></button>)}</nav>
          <div className="mt-auto grid gap-3 pb-3"><div className="glass-panel rounded-3xl p-4"><p className="text-xs font-black text-white">Current status</p><p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">{app.status}</p></div></div>
        </aside>

        <section className="min-w-0 flex-1 lg:pl-4">
          <header className="glass-panel sticky top-3 z-30 mb-4 rounded-[1.7rem] p-3">
            <div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="text-[11px] font-black uppercase tracking-[0.24em] text-violet-200">AutoApp</p><h1 className="truncate text-xl font-black tracking-tight text-white sm:text-2xl">{app.activeJob?.target || "Autonomous Projects"}</h1></div><div className="flex items-center gap-2"><button onClick={app.handleLiveDiagnostics} disabled={app.busy} className="hidden h-11 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-xs font-black text-white disabled:opacity-50 sm:block">Test</button><button onClick={app.handleStartAutonomous} disabled={app.busy} className="neon-button h-11 rounded-2xl px-4 text-xs font-black text-white disabled:opacity-50">New</button></div></div>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1 lg:hidden">{NAV.map((item) => <button key={item.id} onClick={() => setTab(item.id)} className={`shrink-0 rounded-2xl px-4 py-2 text-xs font-black ${tab === item.id ? "bg-white text-black" : "border border-white/10 bg-white/[0.04] text-slate-300"}`}>{item.label}</button>)}</div>
          </header>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0 space-y-4">
              <SessionRecoveryPanel app={recoveryApp} />
              <HeroWorkspace app={app} score={activeScore} health={health} />
              {tab === "overview" ? <><CommandCenter app={app} /><ProjectsPanel app={app} /><ProfessionalPrompt app={app} /><PipelinePanel app={app} /></> : null}
              {tab === "files" ? <FileExplorer app={app} /> : null}
              {tab === "timeline" ? <TimelinePanel app={app} /> : null}
              {tab === "logs" ? <JobLogsPanel app={app} /> : null}
              {tab === "github" ? <GitHubPanel app={app} /> : null}
              {tab === "settings" ? <><PreflightPanel app={app} /><ReleasePanel app={app} /><PipelinePanel app={app} /></> : null}
            </div>
            <aside className="space-y-4"><ScoreCard score={activeScore} app={app} /><StatsCard app={app} /><QuickActions app={app} /><SystemCard app={app} /></aside>
          </section>
        </section>
      </div>
      <RuntimeBanner app={app} />
      <NotificationCenter app={app} />
      <MobileBottomNav tab={tab} setTab={setTab} />
      <FileActionModal mode={app.fileActionMode} value={app.fileActionValue} onChange={app.setFileActionValue} onCancel={app.handleCancelFileAction} onConfirm={app.handleConfirmFileAction} />
      <ConfirmModal open={Boolean(app.confirmDeleteFilePath)} title="Delete file" message={`Delete ${app.confirmDeleteFilePath}?`} confirmLabel="Delete" danger onCancel={app.handleCancelDeleteFile} onConfirm={app.handleConfirmDeleteSelectedFile} />
    </main>
  );
}

function Brand() { return <div className="flex items-center gap-3 pt-4"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-700 text-lg font-black">A</div><div><p className="text-lg font-black tracking-tight text-white">AutoApp</p><p className="text-xs text-slate-500">Product OS</p></div></div>; }
function HeroWorkspace({ app, score, health }: { app: ReturnType<typeof useAutoApp>; score: number; health: string }) { return <section className="glass-panel rounded-[2rem] p-5"><div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-violet-400/25 bg-violet-500/10 px-3 py-1 text-[11px] font-black text-violet-200">{health}</span>{app.activeJob?.infinite ? <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-black text-emerald-200">Infinite improvement</span> : null}</div><h2 className="mt-4 text-2xl font-black tracking-tight text-white md:text-4xl">{app.activeJob?.target || "Build a serious product, not a demo"}</h2><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">{app.activeJob?.prompt || "Create, improve, monitor, export and release autonomous projects from one workspace."}</p></div><ScoreOrb score={score} /></div></section>; }
function CommandCenter({ app }: { app: ReturnType<typeof useAutoApp> }) { const job = app.activeJob; const nextRun = job?.next_run_at ? new Date(job.next_run_at).toLocaleString() : "Not scheduled"; const metrics = [["Status", job?.status || "idle"], ["Phase", job?.phase || "-"], ["Strategy", job?.strategy || "-"], ["Attempts", job ? `${job.attempts}/${job.max_attempts}` : "0"]]; return <section className="glass-panel rounded-[2rem] p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-200">Command Center</p><h2 className="mt-2 text-xl font-black">Autonomous execution</h2><p className="mt-1 text-sm text-slate-500">Next run: {nextRun}</p></div><div className="flex flex-wrap gap-2"><Action onClick={app.handleStepJob} disabled={!job || app.busy}>Run step</Action><Action onClick={app.handleResumeJob} disabled={!job || app.busy}>Resume</Action><Action onClick={() => app.handleImproveJob(app.activeJobId)} disabled={!job || app.busy}>Improve</Action></div></div><div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">{metrics.map(([label, value]) => <Metric key={label} label={label} value={value} />)}</div>{job?.error ? <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-xs text-red-200">{job.error}</div> : null}</section>; }
function ProfessionalPrompt({ app }: { app: ReturnType<typeof useAutoApp> }) { return <section className="glass-panel rounded-[2rem] p-5"><h2 className="text-lg font-black text-white">Create professional project</h2><p className="mt-1 text-sm text-slate-500">Production requirements and autonomous improvement rules are applied automatically.</p><textarea value={app.prompt} onChange={(event) => app.setPrompt(event.target.value)} className="input-premium mt-4 min-h-[220px] w-full rounded-3xl p-4 text-sm leading-6" /><div className="mt-4 grid gap-2 sm:grid-cols-2"><button onClick={app.handleGenerate} disabled={app.busy} className="min-h-12 rounded-2xl border border-white/10 bg-white/[0.06] px-4 text-sm font-black text-white disabled:opacity-50">Generate preview</button><button onClick={app.handleStartAutonomous} disabled={app.busy} className="neon-button min-h-12 rounded-2xl px-4 text-sm font-black text-white disabled:opacity-50">Start autonomous build</button></div></section>; }
function ScoreOrb({ score }: { score: number }) { return <div className="grid min-w-[150px] place-items-center rounded-[2rem] border border-white/10 bg-black/25 p-5"><div className="grid h-28 w-28 place-items-center rounded-full border-[10px] border-violet-500/80"><div className="text-center"><p className="text-3xl font-black text-white">{score}</p><p className="text-xs text-slate-500">/100</p></div></div></div>; }
function ScoreCard({ score, app }: { score: number; app: ReturnType<typeof useAutoApp> }) { return <section className="glass-panel rounded-[2rem] p-5"><p className="text-sm font-black text-white">Overall Score</p><div className="mt-5 grid place-items-center"><div className="grid h-36 w-36 place-items-center rounded-full border-[12px] border-violet-500 bg-black/20"><div className="text-center"><p className="text-4xl font-black text-white">{score}</p><p className="text-xs text-slate-500">/100</p></div></div></div><p className="mt-4 text-center text-sm font-bold text-emerald-300">{score >= 90 ? "Excellent" : score >= 70 ? "Good progress" : "Needs improvement"}</p><p className="mt-2 text-center text-xs text-slate-500">{app.activeJob?.phase ? `Phase: ${app.activeJob.phase}` : "No active phase"}</p></section>; }
function StatsCard({ app }: { app: ReturnType<typeof useAutoApp> }) { const stats = [["Projects", app.jobs.length], ["Running", app.projectStats.running], ["Files", app.projectStats.files], ["Lines", app.projectStats.lines.toLocaleString()]]; return <section className="glass-panel rounded-[2rem] p-5"><p className="text-sm font-black text-white">Project Stats</p><div className="mt-4 grid gap-3">{stats.map(([label, value]) => <div key={label} className="flex items-center justify-between text-sm"><span className="text-slate-500">{label}</span><span className="font-black text-white">{value}</span></div>)}</div></section>; }
function QuickActions({ app }: { app: ReturnType<typeof useAutoApp> }) { return <section className="glass-panel rounded-[2rem] p-5"><p className="text-sm font-black text-white">Quick Actions</p><div className="mt-4 grid gap-2"><Action onClick={() => app.handleImproveJob(app.activeJobId)} disabled={!app.activeJobId || app.busy}>Relaunch Improve</Action><Action onClick={app.handleStepJob} disabled={!app.activeJobId || app.busy}>Run Single Step</Action><Action onClick={app.handleExportZip} disabled={!app.files.length || app.busy}>Export ZIP</Action><Action danger onClick={() => app.handleDeleteProject(app.activeJobId)} disabled={!app.activeJobId || app.busy}>Delete Project</Action></div></section>; }
function SystemCard({ app }: { app: ReturnType<typeof useAutoApp> }) { const checks = app.diagnostics?.checks || app.diagnostics?.live || {}; const values = [["API", app.diagnostics?.ok ? "Operational" : "Unknown"], ["Database", checks.d1?.status || "Unknown"], ["AI", checks.ai?.configured ? "Configured" : "Unknown"], ["GitHub", checks.github?.configured ? "Configured" : "Unknown"]]; return <section className="glass-panel rounded-[2rem] p-5"><div className="flex items-center justify-between"><p className="text-sm font-black text-white">System Status</p><button onClick={app.handleDiagnostics} disabled={app.busy} className="text-xs font-black text-violet-200">Refresh</button></div><div className="mt-4 grid gap-3">{values.map(([label, value]) => <Status key={label} label={label} value={String(value)} />)}</div></section>; }
function Status({ label, value }: { label: string; value: string }) { const healthy = /operational|connected|configured|real/i.test(value); return <div className="flex items-center justify-between gap-3 text-sm"><span className="text-slate-500">{label}</span><span className={`rounded-full px-2 py-1 text-xs font-black ${healthy ? "bg-emerald-500/10 text-emerald-300" : "bg-white/[0.06] text-slate-400"}`}>{value}</span></div>; }
function TimelinePanel({ app }: { app: ReturnType<typeof useAutoApp> }) { const logs = app.jobLogs.length ? app.jobLogs : ["No activity loaded yet."]; return <section className="glass-panel rounded-[2rem] p-5"><div className="flex items-center justify-between"><h2 className="text-xl font-black">Monitor</h2><button onClick={() => app.handleLoadJobLogs(app.activeJobId)} disabled={!app.activeJobId || app.busy} className="rounded-2xl border border-white/10 px-4 py-2 text-xs font-black">Refresh</button></div><div className="mt-4 grid gap-3">{logs.slice(0, 20).map((log, index) => <div key={`${log}-${index}`} className="soft-card rounded-2xl p-4"><p className="text-sm leading-6 text-slate-300">{log}</p></div>)}</div></section>; }
function GitHubPanel({ app }: { app: ReturnType<typeof useAutoApp> }) { return <section className="glass-panel rounded-[2rem] p-5"><h2 className="text-xl font-black">GitHub</h2><p className="mt-1 text-sm text-slate-500">Export generated files and inspect repository history.</p><div className="mt-5 grid gap-3"><input value={app.githubRepo} onChange={(event) => app.setGithubRepo(event.target.value)} placeholder="owner/repo" className="input-premium min-h-12 rounded-2xl px-4 text-sm" /><input value={app.githubBranch} onChange={(event) => app.setGithubBranch(event.target.value)} placeholder="main" className="input-premium min-h-12 rounded-2xl px-4 text-sm" /><button onClick={app.handleExportGitHub} disabled={app.busy || !app.files.length} className="neon-button min-h-12 rounded-2xl px-4 text-sm font-black text-white disabled:opacity-50">Export current files</button><div className="grid grid-cols-2 gap-2"><Action onClick={app.handleGitHubAccessTest} disabled={app.busy}>Test Access</Action><Action onClick={app.handleGitHubWriteTest} disabled={app.busy}>Write Test</Action><Action onClick={app.handleLatestCommit} disabled={app.busy}>Latest Commit</Action><Action onClick={app.handleLoadGitHubHistory} disabled={app.busy}>History</Action></div><GitHubHistoryPanel app={app} /></div></section>; }
function ReleasePanel({ app }: { app: ReturnType<typeof useAutoApp> }) { return <section className="glass-panel rounded-[2rem] p-5"><h2 className="text-xl font-black">Release</h2><p className="mt-1 text-sm text-slate-500">Validate, repair, package and export a deployable project.</p><div className="mt-5 grid gap-3 sm:grid-cols-2"><Action onClick={() => app.handleUtility("Build Check")} disabled={app.busy}>Run Build Check</Action><Action onClick={() => app.handleUtility("Resolve Dependencies")} disabled={app.busy}>Resolve Dependencies</Action><Action onClick={() => app.handleUtility("Publish Report")} disabled={app.busy}>Create Publish Report</Action><Action onClick={app.handleExportZip} disabled={!app.files.length || app.busy}>Export ZIP</Action></div></section>; }
function Action({ children, onClick, disabled, danger }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; danger?: boolean }) { return <button onClick={onClick} disabled={disabled} className={`min-h-12 rounded-2xl border px-4 text-left text-sm font-bold transition disabled:opacity-40 ${danger ? "border-red-400/30 bg-red-500/10 text-red-200" : "border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]"}`}>{children}</button>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3"><p className="truncate text-sm font-black text-white">{value}</p><p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-slate-600">{label}</p></div>; }
function MobileBottomNav({ tab, setTab }: { tab: WorkspaceTab; setTab: (tab: WorkspaceTab) => void }) { const items = NAV.slice(0, 5); return <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-[#05070c]/95 px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 lg:hidden"><div className="mx-auto grid max-w-lg grid-cols-5 gap-1">{items.map((item) => <button key={item.id} onClick={() => setTab(item.id)} className={`min-h-14 rounded-2xl text-center ${tab === item.id ? "bg-violet-600 text-white" : "text-slate-500"}`}><span className="block text-[11px] font-black">{item.icon}</span><span className="mt-1 block text-[10px] font-black">{item.label}</span></button>)}</div></nav>; }
