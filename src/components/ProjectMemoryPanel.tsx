import type { AutoAppState } from "../hooks/useAutoApp";

import { EmptyState } from "./EmptyState";

export function ProjectMemoryPanel({ app }: { app: AutoAppState }) {

const memory = app.projectReport?.memory;

const qualityGate = app.projectReport?.qualityGate;

return (

<section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-4 shadow-2xl">

<div className="mb-4 flex items-start justify-between gap-3">

<div>

<h2 className="text-lg font-black text-white">Project Memory</h2>

<p className="mt-1 text-xs text-zinc-500">

Persistent roadmap, repeated weaknesses, protected systems and recent AI cycles.

</p>

</div>

<button

onClick={() => app.refreshProjectReport()}

disabled={app.busy || !app.activeJobId}

className="min-h-10 rounded-2xl border border-white/10 bg-black/40 px-4 text-xs font-black text-white disabled:opacity-50 active:scale-[0.98]"

>

Refresh

</button>

</div>

{!app.activeJobId ? (

<EmptyState

title="No active project"

description="Open a project to inspect its memory."

/>

) : !memory ? (

<EmptyState

title="No memory report loaded"

description="Refresh the report after a few autonomous cycles."

/>

) : (

<div className="grid gap-4">

{qualityGate ? (

<div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/5 p-4">

<p className="text-xs font-black text-emerald-200">

Quality gate enabled

</p>

<p className="mt-2 text-xs leading-5 text-emerald-200/70">

{qualityGate.exportPolicy}

</p>

<p className="mt-2 text-[11px] text-emerald-200/50">

Minimum quality score: {qualityGate.minimumQualityScore}/100

</p>

</div>

) : null}

<MemorySection title="Roadmap">

{memory.roadmap?.length ? (

memory.roadmap.map((item: any) => (

<article

key={item.id}

className="rounded-2xl border border-white/10 bg-black/40 p-3"

>

<div className="flex items-start justify-between gap-3">

<p className="text-sm font-bold text-white">{item.title}</p>

<span className="rounded-full bg-white/10 px-2 py-1 text-[10px] text-zinc-300">

{item.status}

</span>

</div>

<p className="mt-2 text-xs leading-5 text-zinc-500">

{item.reason}

</p>

<p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-zinc-600">

priority {item.priority}

</p>

</article>

))

) : (

<p className="text-sm text-zinc-500">No roadmap items yet.</p>

)}

</MemorySection>

<MemorySection title="Repeated weaknesses">

{Object.keys(memory.repeatedWeaknesses || {}).length ? (

<div className="flex flex-wrap gap-2">

{Object.entries(memory.repeatedWeaknesses).map(([key, value]) => (

<span

key={key}

className="rounded-full border border-white/10 bg-black/40 px-3 py-2 text-xs text-zinc-300"

>

{key}: {String(value)}

</span>

))}

</div>

) : (

<p className="text-sm text-zinc-500">No repeated weakness detected.</p>

)}

</MemorySection>

<MemorySection title="Protected systems">

{memory.protectedSignals?.length ? (

<div className="flex flex-wrap gap-2">

{memory.protectedSignals.map((signal: string) => (

<span

key={signal}

className="rounded-full border border-cyan-400/20 bg-cyan-500/5 px-3 py-2 text-xs text-cyan-200"

>

{signal}

</span>

))}

</div>

) : (

<p className="text-sm text-zinc-500">No protected signals yet.</p>

)}

</MemorySection>

<MemorySection title="Recent cycles">

{memory.cycles?.length ? (

memory.cycles.map((cycle: any) => (

<article

key={`${cycle.at}-${cycle.phase}-${cycle.strategy}`}

className="rounded-2xl border border-white/10 bg-black/40 p-3"

>

<p className="text-sm font-bold text-white">

{cycle.phase} · {cycle.strategy}

</p>

<p className="mt-1 text-xs text-zinc-500">

score {cycle.score}/100 · build {cycle.buildOk ? "ok" : "issues"} ·{" "}

{new Date(cycle.at).toLocaleString()}

</p>

<p className="mt-2 text-xs leading-5 text-zinc-500">

Next focus: {cycle.nextFocus}

</p>

</article>

))

) : (

<p className="text-sm text-zinc-500">No cycle recorded yet.</p>

)}

</MemorySection>

</div>

)}

</section>

);

}

function MemorySection({

title,

children,

}: {

title: string;

children: React.ReactNode;

}) {

return (

<div>

<h3 className="mb-2 text-xs font-black uppercase tracking-[0.22em] text-zinc-500">

{title}

</h3>

<div className="grid gap-2">{children}</div>

</div>

);

  }
