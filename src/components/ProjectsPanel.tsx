import type { AutoAppState } from "../hooks/useAutoApp";

import { ActionButton } from "./ActionButton";

import { Panel } from "./Panel";

export function ProjectsPanel({ app }: { app: AutoAppState }) {

const sortedJobs = [...app.jobs].sort(

(a, b) => Number(b.updated_at || 0) - Number(a.updated_at || 0)

);

return (

<Panel

title="Projects"

subtitle="Persistent autonomous projects. They continue through Cloudflare cron even when this window is closed."

>

<div className="mb-4 grid gap-3">

<ActionButton onClick={() => app.refreshJobs()} disabled={app.busy}>

Refresh projects

</ActionButton>

</div>

<div className="grid max-h-[520px] gap-3 overflow-auto pr-1">

{sortedJobs.length ? (

sortedJobs.map((job) => {

const isActive = app.activeJobId === job.id;

const updatedAt = job.updated_at

? new Date(job.updated_at).toLocaleString()

: "unknown";

return (

<article

key={job.id}

className={`rounded-2xl border p-4 transition ${

isActive

? "border-white/30 bg-white/10"

: "border-white/10 bg-black/40"

}`}

>

<div className="flex items-start justify-between gap-3">

<div className="min-w-0">

<p className="truncate text-sm font-black text-white">

{job.target || "project"}

</p>

<p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-400">

{job.prompt}

</p>

</div>

<span className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-xs text-zinc-300">

{job.status}

</span>

</div>

<div className="mt-3 grid grid-cols-2 gap-2 text-xs text-zinc-500">

<p>Score: {job.score}/100</p>

<p>Phase: {job.phase}</p>

<p>Attempts: {job.attempts}/{job.max_attempts}</p>

<p>Updated: {updatedAt}</p>

</div>

<div className="mt-4 grid gap-2 md:grid-cols-3">

<button

onClick={() => app.handleOpenProject(job.id)}

disabled={app.busy}

className="rounded-xl bg-white px-3 py-2 text-xs font-black text-black disabled:opacity-50"

>

Open

</button>

<button

onClick={() => app.handleImproveJob(job.id)}

disabled={app.busy}

className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs font-black text-white disabled:opacity-50"

>

Improve forever

</button>

<button

onClick={() => app.refreshJobFiles(job.id)}

disabled={app.busy}

className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs font-black text-white disabled:opacity-50"

>

Load files

</button>

</div>

</article>

);

})

) : (

<p className="rounded-2xl border border-white/10 bg-black/40 p-4 text-sm text-zinc-500">

No project yet. Start a real autonomous job to create one.

</p>

)}

</div>

</Panel>

);

}
