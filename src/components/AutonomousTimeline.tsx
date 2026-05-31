import type { AutoAppState } from "../hooks/useAutoApp";

import { EmptyState } from "./EmptyState";

export function AutonomousTimeline({ app }: { app: AutoAppState }) {

const cycles = app.projectReport?.memory?.cycles || [];

const logs = app.jobLogs || [];

return (

<section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-4 shadow-2xl">

<div className="mb-4 flex items-start justify-between gap-3">

<div>

<h2 className="text-lg font-black text-white">Autonomous Timeline</h2>

<p className="mt-1 text-xs text-zinc-500">

Recent cycles, strategies, score movement and important system events.

</p>

</div>

<button

onClick={() => {

if (app.activeJobId) {

app.refreshJobLogs(app.activeJobId);

app.refreshProjectReport(app.activeJobId);

}

}}

disabled={app.busy || !app.activeJobId}

className="min-h-10 rounded-2xl border border-white/10 bg-black/40 px-4 text-xs font-black text-white disabled:opacity-50 active:scale-[0.98]"

>

Refresh

</button>

</div>

{!app.activeJobId ? (

<EmptyState

title="No active project"

description="Open a project to view its autonomous timeline."

/>

) : (

<div className="grid gap-3">

{cycles.length ? (

cycles.slice(0, 10).map((cycle: any, index: number) => (

<article

key={`${cycle.at}-${index}`}

className="rounded-2xl border border-white/10 bg-black/40 p-4"

>

<div className="flex items-start justify-between gap-3">

<div>

<p className="text-sm font-black text-white">

{cycle.phase || "cycle"} · {cycle.strategy || "normal"}

</p>

<p className="mt-1 text-xs text-zinc-500">

{cycle.at ? new Date(cycle.at).toLocaleString() : "unknown time"}

</p>

</div>

<span

className={`rounded-full px-3 py-1 text-[10px] font-black ${

cycle.buildOk

? "bg-emerald-500/10 text-emerald-200"

: "bg-red-500/10 text-red-200"

}`}

>

{cycle.buildOk ? "build ok" : "build issues"}

</span>

</div>

<div className="mt-3 grid grid-cols-3 gap-2">

<Metric label="Score" value={`${cycle.score || 0}/100`} />

<Metric label="Files" value={`${cycle.fileCount || 0}`} />

<Metric label="Next" value={cycle.nextFocus || "-"} />

</div>

{cycle.summary ? (

<p className="mt-3 text-xs leading-5 text-zinc-500">

{cycle.summary}

</p>

) : null}

</article>

))

) : logs.length ? (

logs.slice(0, 8).map((log, index) => (

<article

key={`${log}-${index}`}

className="rounded-2xl border border-white/10 bg-black/40 p-4"

>

<p className="text-xs leading-5 text-zinc-400">{log}</p>

</article>

))

) : (

<EmptyState

title="No cycles yet"

description="Let the autonomous job run one or more cycles."

/>

)}

</div>

)}

</section>

);

}

function Metric({ label, value }: { label: string; value: string }) {

return (

<div className="rounded-xl border border-white/10 bg-white/[0.03] px-2 py-2">

<p className="truncate text-xs font-black text-white">{value}</p>

<p className="mt-1 text-[9px] uppercase tracking-[0.16em] text-zinc-600">

{label}

</p>

</div>

);

}
