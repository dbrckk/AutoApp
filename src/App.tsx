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

<main className="min-h-screen overflow-x-hidden bg-[#050505] text-white">

<TopStatusBar app={app} />

<RuntimeBanner app={app} />

<NotificationCenter app={app} />

<section className="mx-auto min-h-screen max-w-7xl px-3 pb-32 pt-24 md:px-6 lg:px-8">

<div className="hidden gap-5 lg:grid lg:grid-cols-[420px_1fr]">

<aside className="space-y-5">

<SessionRecoveryPanel app={app} />

<PromptPanel app={app} />

<QuickActionsPanel app={app} />

<GitHubPanel app={app} />

<ProjectToolsPanel app={app} />

<SystemStatusPanel app={app} />

<SchemaHealthPanel app={app} />

<ActivityPanel app={app} />

<ReleaseChecklistPanel app={app} />

<ReleaseChecklistPanel app={app} />

<Suspense fallback={<PanelFallback title="Snapshots" />}>

<SnapshotsPanel app={app} />

</Suspense>

</aside>

<section className="space-y-5">

<DashboardScreen app={app} />

<ProjectScoreRadar app={app} />

<BuildReadinessPanel app={app} />

<BuildReadinessPanel app={app} />

<ProjectsPanel app={app} />

<ProjectMemoryPanel app={app} />

<AutonomousTimeline app={app} />

<FileExplorer app={app} />

<JobLogsPanel app={app} />

<Suspense fallback={<PanelFallback title="GitHub history" />}>

<GitHubHistoryPanel app={app} />

</Suspense>

<ResultPanel result={resultPayload} />

</section>

</div>

<div className="lg:hidden">

<MobileScreen active={activeTab === "home"}>

<SessionRecoveryPanel app={app} />

<DashboardScreen app={app} />

<QuickActionsPanel app={app} />

<SystemStatusPanel app={app} />

<ProjectScoreRadar app={app} />

<PromptPanel app={app} />

</MobileScreen>

<MobileScreen active={activeTab === "projects"}>

<ProjectsPanel app={app} />

<ProjectMemoryPanel app={app} />

<AutonomousTimeline app={app} />

<JobLogsPanel app={app} />

</MobileScreen>

<MobileScreen active={activeTab === "editor"}>

<FileExplorer app={app} />

</MobileScreen>

<MobileScreen active={activeTab === "github"}>

<GitHubPanel app={app} />

<Suspense fallback={<PanelFallback title="GitHub history" />}>

<GitHubHistoryPanel app={app} />

</Suspense>

</MobileScreen>

<MobileScreen active={activeTab === "tools"}>

<ProjectToolsPanel app={app} />

<SchemaHealthPanel app={app} />

<ActivityPanel app={app} />

<Suspense fallback={<PanelFallback title="Diagnostics" />}>

<DiagnosticsLazyPanel app={app} />

</Suspense>

<Suspense fallback={<PanelFallback title="Snapshots" />}>

<SnapshotsPanel app={app} />

</Suspense>

<ResultPanel result={resultPayload} />

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

function PanelFallback({ title }: { title: string }) {

return (

<section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">

<h2 className="text-lg font-black text-white">{title}</h2>

<div className="mt-4 h-20 animate-pulse rounded-2xl bg-white/5" />

</section>

);

  }
