import type { AutoAppState } from "../hooks/useAutoApp";

export function SchemaHealthPanel({ app }: { app: AutoAppState }) {

const schema =

app.diagnostics?.checks?.schemaInspection ||

app.diagnostics?.live?.schemaInspection ||

app.diagnostics?.inspection;

const table = schema?.tables?.[0];

const missing = table?.missingColumns || [];

return (

<section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-4 shadow-2xl">

<div className="mb-4 flex items-start justify-between gap-3">

<div>

<h2 className="text-lg font-black text-white">Schema Health</h2>

<p className="mt-1 text-xs text-zinc-500">

D1 table and memory column status.

</p>

</div>

<button

onClick={() => app.handleLiveDiagnostics()}

disabled={app.busy}

className="min-h-10 rounded-2xl border border-white/10 bg-black/40 px-4 text-xs font-black text-white disabled:opacity-50 active:scale-[0.98]"

>

Check

</button>

</div>

{!schema ? (

<div className="rounded-2xl border border-white/10 bg-black/40 p-4">

<p className="text-sm text-zinc-400">

Run live diagnostics to inspect D1 schema.

</p>

</div>

) : (

<div className="grid gap-3">

<div

className={`rounded-2xl border p-4 ${

missing.length

? "border-yellow-400/20 bg-yellow-500/5"

: "border-emerald-400/20 bg-emerald-500/5"

}`}

>

<p

className={`text-sm font-black ${

missing.length ? "text-yellow-200" : "text-emerald-200"

}`}

>

{missing.length ? "Schema needs attention" : "Schema ready"}

</p>

<p className="mt-2 text-xs leading-5 text-zinc-400">

Table <span className="font-bold text-white">jobs</span>{" "}

{table?.exists ? "exists" : "is missing"}.

</p>

</div>

<div className="rounded-2xl border border-white/10 bg-black/40 p-4">

<p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">

Required columns

</p>

<div className="mt-3 flex flex-wrap gap-2">

{(table?.requiredColumns || []).map((column: string) => {

const ok = table?.columns?.includes(column);

return (

<span

key={column}

className={`rounded-full border px-3 py-2 text-xs ${

ok

? "border-emerald-400/20 bg-emerald-500/5 text-emerald-200"

: "border-red-400/20 bg-red-500/5 text-red-200"

}`}

>

{column}

</span>

);

})}

</div>

</div>

{missing.length ? (

<div className="rounded-2xl border border-red-400/20 bg-red-500/5 p-4">

<p className="text-xs font-black text-red-200">Missing</p>

<p className="mt-2 text-xs text-red-200/70">

{missing.join(", ")}

</p>

</div>

) : null}

</div>

)}

</section>

);

}
