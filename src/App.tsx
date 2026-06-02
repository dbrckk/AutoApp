import { Suspense, lazy, useMemo, useState } from "react";

import { useAutoApp } from "./hooks/useAutoApp";

import { ErrorBoundary } from "./components/ErrorBoundary";

import { RuntimeBanner } from "./components/RuntimeBanner";

import { NotificationCenter } from "./components/NotificationCenter";

import { FloatingCommandBar } from "./components/FloatingCommandBar";

import { TopStatusBar } from "./components/TopStatusBar";

import { MobileTabBar, type AppTab } from "./components/MobileTabBar";

import { MobileScreen } from "./components/MobileScreen";

import { DashboardScreen } from "./components/DashboardScreen";

import { PromptPanel } from "./components/PromptPanel";

import { GitHubPanel } from "./components/GitHubPanel";

import { ProjectToolsPanel } from "./components/ProjectToolsPanel";

import { QuickActionsPanel } from "./components/QuickActionsPanel";

import { ProjectsPanel } from "./components/ProjectsPanel";

import { ProjectMemoryPanel } from "./components/ProjectMemoryPanel";

import { SystemStatusPanel } from "./components/SystemStatusPanel";

import { AutonomousTimeline } from "./components/AutonomousTimeline";

import { ProjectScoreRadar } from "./components/ProjectScoreRadar";

import { SchemaHealthPanel } from "./components/SchemaHealthPanel";

import { SessionRecoveryPanel } from "./components/SessionRecoveryPanel";

import { ActivityPanel } from "./components/ActivityPanel";

import { BuildReadinessPanel } from "./components/BuildReadinessPanel";

import { ReleaseChecklistPanel } from "./components/ReleaseChecklistPanel";

import { PreflightPanel } from "./components/PreflightPanel";

import { JobLogsPanel } from "./components/JobLogsPanel";

import { FileExplorer } from "./components/FileExplorer";

import { ResultPanel } from "./components/ResultPanel";

import { FileActionModal } from "./components/FileActionModal";

import { ConfirmModal } from "./components/ConfirmModal";

const SnapshotsPanel = lazy(() =>

import("./components/SnapshotsPanel").then((mod) => ({

default: mod.SnapshotsPanel,

}))

);

const GitHubHistoryPanel = lazy(() =>

import("./components/GitHubHistoryPanel").then((mod) => ({

default: mod.GitHubHistoryPanel,

}))

);

const DiagnosticsLazyPanel = lazy(() =>

import("./components/DiagnosticsPanel").then((mod) => ({

default: mod.DiagnosticsPanel,

}))

);

export default function App() {

return (

<ErrorBoundary>

<AutoAppShell />

</ErrorBoundary>

);

}

function AutoAppShell() {

const app = useAutoApp();

const [activeTab, setActiveTab] = useState<AppTab>("home");

const resultPayload = useMemo(

() => app.result || app.diagnostics || app.projectReport || {},

[app.result, app.diagnostics, app.projectReport]

);

return (

<main className="app-shell text-white">

<TopStatusBar app={app} />

<RuntimeBanner app={app} />

<NotificationCenter app={app} />

<section className="mx-auto w-full max-w-[1500px] px-3 pb-40 pt-24 md:px-6 lg:px-8">

<div className="mb-4 rounded-[2rem] border border-emerald-400/25 bg-emerald-500/10 p-4 text-sm font-black text-emerald-100 shadow-2xl">

UI/UX V2 ACTIVE — scroll fix deployed

</div>

<div className="desktop-workspace hidden lg:grid">

<aside className="desktop-sidebar space-y-4">

<HeroCard app={app} />

<SessionRecoveryPanel app={app} />

<QuickActionsPanel app={app} />

<ProjectsPanel app={app} />

<GitHubPanel app={app} />

<ProjectToolsPanel app={app} />

</aside>

<section className="desktop-main space-y-4">

<div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">

<div className="space-y-4">

<DashboardScreen app={app} />

<FileExplorer app={app} />

<AutonomousTimeline app={app} />

<JobLogsPanel app={app} />

</div>

<aside className="space-y-4">

<ProjectScoreRadar app={app} />

<BuildReadinessPanel app={app} />

<PreflightPanel app={app} />

<ProjectMemoryPanel app={app} />

<SystemStatusPanel app={app} />

<SchemaHealthPanel app={app} />

</aside>

</div>

<div className="grid gap-4 xl:grid-cols-2">

<ActivityPanel app={app} />

<ReleaseChecklistPanel app={app} />

</div>

<Suspense fallback={<PanelFallback title="GitHub history" />}>

<GitHubHistoryPanel app={app} />

</Suspense>

<Suspense fallback={<PanelFallback title="Diagnostics" />}>

<DiagnosticsLazyPanel app={app} />

</Suspense>

<Suspense fallback={<PanelFallback title="Snapshots" />}>

<SnapshotsPanel app={app} />

</Suspense>

<ResultPanel result={resultPayload} />

</section>

</div>

<div className="lg:hidden">

<MobileScreen active={activeTab === "home"}>

<HeroCard app={app} />

<SessionRecoveryPanel app={app} />

<DashboardScreen app={app} />

<QuickActionsPanel app={app} />

<ProjectScoreRadar app={app} />

<BuildReadinessPanel app={app} />

<PromptPanel app={app} />

</MobileScreen>

<MobileScreen active={activeTab === "projects"}>

<ProjectsPanel app={app} />

<FileExplorer app={app} />

<ProjectMemoryPanel app={app} />

<AutonomousTimeline app={app} />

<JobLogsPanel app={app} />

</MobileScreen>

<MobileScreen active={activeTab === "editor"}>

<FileExplorer app={app} />

<ResultPanel result={resultPayload} />

</MobileScreen>

<MobileScreen active={activeTab === "github"}>

<GitHubPanel app={app} />

<Suspense fallback={<PanelFallback title="GitHub history" />}>

<GitHubHistoryPanel app={app} />

</Suspense>

</MobileScreen>

<MobileScreen active={activeTab === "tools"}>

<ProjectToolsPanel app={app} />

<PreflightPanel app={app} />

<SystemStatusPanel app={app} />

<SchemaHealthPanel app={app} />

<ActivityPanel app={app} />

<ReleaseChecklistPanel app={app} />

<Suspense fallback={<PanelFallback title="Diagnostics" />}>

<DiagnosticsLazyPanel app={app} />

</Suspense>

<Suspense fallback={<PanelFallback title="Snapshots" />}>

<SnapshotsPanel app={app} />

</Suspense>

</MobileScreen>

</div>

</section>

<FloatingCommandBar app={app} />

<MobileTabBar activeTab={activeTab} onChange={setActiveTab} />

<FileActionModal

mode={app.fileActionMode}

value={app.fileActionValue}

onChange={app.setFileActionValue}

onCancel={app.handleCancelFileAction}

onConfirm={app.handleConfirmFileAction}

/>

<ConfirmModal

open={Boolean(app.confirmDeleteFilePath)}

title="Delete file"

message={`Delete ${app.confirmDeleteFilePath}? A local snapshot will be saved before deletion.`}

confirmLabel="Delete"

danger

onCancel={app.handleCancelDeleteFile}

onConfirm={app.handleConfirmDeleteSelectedFile}

/>

</main>

);

}

function HeroCard({ app }: { app: ReturnType<typeof useAutoApp> }) {

return (

<section className="premium-panel rounded-[2rem] p-5">

<div className="flex items-start justify-between gap-4">

<div>

<p className="text-xs font-black uppercase tracking-[0.28em] text-emerald-200">

AutoApp OS

</p>

<h1 className="mt-3 text-3xl font-black tracking-tight text-white">

Autonomous product workspace

</h1>

<p className="mt-3 text-sm leading-6 text-zinc-400">

Build, monitor, repair and export autonomous projects from one focused workspace.

</p>

</div>

<div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-right">

<p className="text-2xl font-black text-white">

{app.activeJob?.score || app.projectReport?.score?.total || 0}

</p>

<p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">

score

</p>

</div>

</div>

<div className="mt-5 grid grid-cols-3 gap-2">

<MiniStat label="Files" value={String(app.files?.length || 0)} />

<MiniStat label="Jobs" value={String(app.jobs?.length || 0)} />

<MiniStat label="State" value={app.busy ? "busy" : "ready"} />

</div>

</section>

);

}

function MiniStat({ label, value }: { label: string; value: string }) {

return (

<div className="premium-card rounded-2xl px-3 py-3">

<p className="truncate text-sm font-black text-white">{value}</p>

<p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-zinc-500">

{label}

</p>

</div>

);

}

function PanelFallback({ title }: { title: string }) {

return (

<section className="premium-panel rounded-3xl p-5">

<h2 className="text-lg font-black text-white">{title}</h2>

<div className="mt-4 h-20 animate-pulse rounded-2xl bg-white/5" />

</section>

);

  }
