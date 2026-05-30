import type { AutoAppState } from "../hooks/useAutoApp";

import { EmptyState } from "./EmptyState";

import { StatusBadge } from "./StatusBadge";

export function ProjectsPanel({ app }: { app: AutoAppState }) {

return (

<section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-4 shadow-2xl">

<div className="mb-4 flex items-start justify-between gap-3">

<div>

<h2 className="text-lg font-black text-white">Projects</h2>

<p className="mt-1 text-xs text-zinc-500">

Persistent autonomous jobs. They continue from Cloudflare cron.

</p>

</div>

<button

onClick={() => app.refreshJobs()}

disabled={app.busy}

className="min-h-10 rounded-2xl border border-white/10 bg-black/40 px-4 text-xs font-black text-white disabled:opacity-50 active:scale-[0.98]"

>

Refresh

</button>

</div>

<label className="mb-4 flex items-center justify-between rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-zinc-300">

<span>Auto-refresh jobs</span>

<input

type="checkbox"

checked={app.autoRefreshJobs}

onChange={(event) => app.setAutoRefreshJobs(event.target.checked)}

/>

</label>

<div className="grid gap-3">

{app.jobs.length ? (

app.jobs.map((job) => {

const selected = app.activeJobId === job.id;

return (

<article

key={job.id}

className={`rounded-3xl border p-4 transition ${

selected

? "border-white/30 bg-white/10"

: "border-white/10 bg-black/40"

}`}

>

<button

onClick={() => app.handleOpenJob(job.id)}

className="block w-full text-left"

>

<div className="flex items-start justify-between gap-3">

<div className="min-w-0">

<p className="truncate text-sm font-black text-white">

{job.target || "Project"}

</p>

<p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-500">

{job.prompt}

</p>

</div>

<StatusBadge value={job.status} />

</div>

<div className="mt-3 grid grid-cols-3 gap-2 text-center">

<Metric label="Score" value={`${job.score || 0}`} />

<Metric label="Phase" value={job.phase || "-"} />

<Metric

label="Attempts"

value={`${job.attempts || 0}/${job.max_attempts || 0}`}

/>

</div>

</button>

<div className="mt-3 grid gap-2 sm:grid-cols-3">

<button

onClick={() => app.handleOpenJob(job.id)}

disabled={app.busy}

className="min-h-11 rounded-2xl bg-white px-4 text-xs font-black text-black disabled:opacity-50 active:scale-[0.98]"

>

Open

</button>

<button

onClick={() => app.handleImproveJob(job.id)}

disabled={app.busy}

className="min-h-11 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 text-xs font-black text-emerald-200 disabled:opacity-50 active:scale-[0.98]"

>

Improve

</button>

<button

onClick={() => {

app.setActiveJobId(job.id);

app.refreshJobLogs(job.id);

}}

disabled={app.busy}

className="min-h-11 rounded-2xl border border-white/10 bg-black/40 px-4 text-xs font-black text-white disabled:opacity-50 active:scale-[0.98]"

>

Logs

</button>

</div>

</article>

);

})

) : (

<EmptyState

title="No projects yet"

description="Start an autonomous project from the Home tab."

/>

)}

</div>

</section>

);

}

function Metric({ label, value }: { label: string; value: string }) {

return (

<div className="rounded-2xl border border-white/10 bg-black/30 px-2 py-3">

<p className="truncate text-xs font-black text-white">{value}</p>

<p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-zinc-600">

{label}

</p>

</div>

);

}
