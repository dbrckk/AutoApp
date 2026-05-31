import type { AutoAppState } from "../hooks/useAutoApp";

import { runFrontendPreflight } from "../lib/preflight";

export function PreflightPanel({ app }: { app: AutoAppState }) {

const result = runFrontendPreflight({

files: app.files || [],

githubRepo: app.githubRepo || "",

projectReport: app.projectReport,

diagnostics: app.diagnostics,

});

return (

<section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-4 shadow-2xl">

<div className="mb-4 flex items-start justify-between gap-3">

<div>

<h2 className="text-lg font-black text-white">Preflight</h2>

<p className="mt-1 text-xs text-zinc-500">

Minimal checks before export, deployment or Android packaging.

</p>

</div>

<div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-right">

<p className="text-xl font-black text-white">{result.score}%</p>

<p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600">

pass

</p>

</div>

</div>

<div className="mb-4 h-3 overflow-hidden rounded-full bg-white/10">

<div

className={`h-full rounded-full ${

result.ok

? "bg-emerald-400"

: result.score >= 60

? "bg-yellow-300"

: "bg-red-400"

}`}

style={{ width: `${result.score}%` }}

/>

</div>

<StatusGroup

title="Blockers"

items={result.blockers}

empty="No blocking issue detected."

tone="red"

/>

<StatusGroup

title="Warnings"

items={result.warnings}

empty="No warning detected."

tone="yellow"

/>

<StatusGroup

title="Passed"

items={result.passed}

empty="No checks passed yet."

tone="emerald"

/>

</section>

);

}

function StatusGroup({

title,

items,

empty,

tone,

}: {

title: string;

items: string[];

empty: string;

tone: "red" | "yellow" | "emerald";

}) {

const toneClass =

tone === "red"

? "border-red-400/20 bg-red-500/5 text-red-200"

: tone === "yellow"

? "border-yellow-400/20 bg-yellow-500/5 text-yellow-200"

: "border-emerald-400/20 bg-emerald-500/5 text-emerald-200";

return (

<div className="mb-4 last:mb-0">

<h3 className="mb-2 text-xs font-black uppercase tracking-[0.22em] text-zinc-500">

{title}

</h3>

<div className="grid gap-2">

{(items.length ? items : [empty]).map((item) => (

<div

key={item}

className={`rounded-2xl border px-3 py-2 text-xs leading-5 ${toneClass}`}

>

{item}

</div>

))}

</div>

</div>

);

  }
