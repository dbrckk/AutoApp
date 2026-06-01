import { useAutoApp } from "./hooks/useAutoApp";

import { PromptPanel } from "./components/PromptPanel";

import { GitHubPanel } from "./components/GitHubPanel";

import { DiagnosticsPanel } from "./components/DiagnosticsPanel";

import { ProjectToolsPanel } from "./components/ProjectToolsPanel";

import { SnapshotsPanel } from "./components/SnapshotsPanel";

import { ProjectsPanel } from "./components/ProjectsPanel";

import { JobList } from "./components/JobList";

import { FileExplorer } from "./components/FileExplorer";

import { ResultPanel } from "./components/ResultPanel";

import { Panel } from "./components/Panel";

import { FileActionModal } from "./components/FileActionModal";

import { ConfirmModal } from "./components/ConfirmModal";

export default function App() {

const app = useAutoApp();

return (

<main className="min-h-screen bg-[#050505] px-4 pb-6 pt-24 text-white md:px-8">

<div className="fixed left-0 right-0 top-0 z-40 border-b border-white/10 bg-black/90 px-4 py-3 backdrop-blur">

<div className="mx-auto flex max-w-7xl items-center justify-between gap-3">

<div className="min-w-0">

<p className="text-sm font-black text-white">

{app.busy ? "Working..." : "AutoApp"}

</p>

<p className="line-clamp-1 text-xs text-zinc-400">

{app.status}

</p>

</div>

<button

onClick={() => app.handleDiagnostics()}

disabled={app.busy}

className="shrink-0 rounded-xl border border-white/10 bg-white px-3 py-2 text-xs font-black text-black disabled:opacity-50"

>

Test API

</button>

</div>

</div>

<section className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[430px_1fr]">

<aside className="space-y-5">

<PromptPanel app={app} />

<ProjectsPanel app={app} />

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

Active project: {app.activeJobId}

</p>

) : null}

{app.githubRepo ? (

<p className="mt-2 break-all text-xs text-zinc-500">

GitHub target: {app.githubRepo} · branch {app.githubBranch || "main"}

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
