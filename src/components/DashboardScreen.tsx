import type { AutoAppState } from "../hooks/useAutoApp";

import { ActionButton } from "./ActionButton";

import { DiagnosticsPanel } from "./DiagnosticsPanel";

import { MobileScreen } from "./MobileScreen";

import { Panel } from "./Panel";

import { PromptPanel } from "./PromptPanel";

import { ProjectToolsPanel } from "./ProjectToolsPanel";

import { SnapshotsPanel } from "./SnapshotsPanel";

export function DashboardScreen({ app }: { app: AutoAppState }) {

const latestJob = app.jobs[0];

return (

<MobileScreen

title="Build autonomous apps"

subtitle="Create, improve, export and monitor real projects from your phone."

actions={

<button

onClick={app.handleDiagnostics}

disabled={app.busy}

className="rounded-2xl bg-white px-4 py-3 text-xs font-black text-black disabled:opacity-50"

>

Test API

</button>

}

>

<div className="grid gap-4 md:grid-cols-3">

<MetricCard label="Files" value={String(app.files.length)} />

<MetricCard label="Jobs" value={String(app.jobs.length)} />

<MetricCard label="Status" value={app.busy ? "Working" : "Ready"} />

</div>

{latestJob ? (

<Panel title="Latest project" subtitle="Most recent autonomous job.">

<div className="rounded-2xl border border-white/10 bg-black/40 p-4">

<div className="flex items-center justify-between gap-3">

<div>

<p className="text-sm font-black text-white">{latestJob.target}</p>

<p className="mt-1 text-xs text-zinc-500">

{latestJob.phase} · score {latestJob.score}/100

</p>

</div>

<span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-zinc-300">

{latestJob.status}

</span>

</div>

<p className="mt-3 line-clamp-3 text-sm leading-6 text-zinc-400">

{latestJob.prompt}

</p>

<div className="mt-4 grid gap-3 sm:grid-cols-3">

<ActionButton

onClick={() => {

app.setActiveJobId(latestJob.id);

app.refreshJobFiles(latestJob.id).catch(() => undefined);

app.setActiveTab("projects");

}}

disabled={app.busy}

>

Open

</ActionButton>

<ActionButton

onClick={() => app.handleImproveJob(latestJob.id)}

disabled={app.busy}

variant="primary"

>

Improve

</ActionButton>

<ActionButton

onClick={() => app.setActiveTab("logs")}

disabled={app.busy}

>

Logs

</ActionButton>

</div>

</div>

</Panel>

) : null}

<PromptPanel app={app} />

<ProjectToolsPanel app={app} />

<DiagnosticsPanel app={app} />

<SnapshotsPanel app={app} />

</MobileScreen>

);

}

function MetricCard({ label, value }: { label: string; value: string }) {

return (

<div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-xl">

<p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">

{label}

</p>

<p className="mt-2 text-2xl font-black text-white">{value}</p>

</div>

);

}
