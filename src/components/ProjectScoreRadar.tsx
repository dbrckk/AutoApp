import type { AutoAppState } from "../hooks/useAutoApp";

export function ProjectScoreRadar({ app }: { app: AutoAppState }) {

const score = app.projectReport?.score || {};

const metrics = [

["Architecture", score.architecture],

["UI", score.ui],

["Mobile", score.mobile],

["Reliability", score.reliability],

["Depth", score.productDepth],

["Gameplay", score.gameplay],

["Retention", score.retention],

["Android", score.androidReady],

];

const total = Number(score.total || app.activeJob?.score || 0);

return (

<section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-4 shadow-2xl">

<div className="mb-4 flex items-start justify-between gap-3">

<div>

<h2 className="text-lg font-black text-white">Score Radar</h2>

<p className="mt-1 text-xs text-zinc-500">

Quality breakdown used by the autonomous strategy engine.

</p>

</div>

<div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-right">

<p className="text-xl font-black text-white">{total}</p>

<p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600">

total

</p>

</div>

</div>

<div className="grid gap-3">

{metrics.map(([label, value]) => {

const numeric = Number(value || 0);

return (

<div key={String(label)}>

<div className="mb-1 flex items-center justify-between">

<span className="text-xs font-bold text-zinc-300">

{label}

</span>

<span className="text-xs font-black text-white">

{numeric}/100

</span>

</div>

<div className="h-3 overflow-hidden rounded-full bg-white/10">

<div

className={`h-full rounded-full ${

numeric >= 85

? "bg-emerald-400"

: numeric >= 65

? "bg-yellow-300"

: "bg-red-400"

}`}

style={{ width: `${Math.max(0, Math.min(100, numeric))}%` }}

/>

</div>

</div>

);

})}

</div>

{app.projectReport?.focus ? (

<div className="mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-500/5 p-4">

<p className="text-xs font-black text-cyan-200">Current focus</p>

<p className="mt-1 text-sm font-bold text-white">

{app.projectReport.focus}

</p>

</div>

) : null}

</section>

);

  }
