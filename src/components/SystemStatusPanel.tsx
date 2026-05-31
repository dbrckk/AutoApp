import type { AutoAppState } from "../hooks/useAutoApp";

export function SystemStatusPanel({ app }: { app: AutoAppState }) {

const caps =

app.diagnostics?.realCapabilities ||

app.diagnostics?.live?.realCapabilities ||

app.diagnostics?.checks?.realCapabilities ||

{};

const live = app.diagnostics?.live || {};

const checks = app.diagnostics?.checks || {};

const items = [

{

label: "API",

value: app.diagnostics?.ok ? "online" : "unknown",

ok: Boolean(app.diagnostics?.ok),

},

{

label: "D1 jobs",

value: caps.d1Jobs || live.d1?.status || checks.d1?.status || "unknown",

ok: caps.d1Jobs === "real" || live.d1?.status === "connected",

},

{

label: "Project memory",

value: caps.projectMemory || "unknown",

ok: caps.projectMemory === "real",

},

{

label: "GitHub export",

value: caps.githubExport || "unknown",

ok: caps.githubExport === "real",

},

{

label: "AI",

value: caps.aiGeneration || live.ai?.provider || checks.ai?.provider || "unknown",

ok: caps.aiGeneration === "real" || Boolean(live.ai?.configured || checks.ai?.configured),

},

{

label: "Quality gate",

value: caps.qualityGate || "real",

ok: true,

},

{

label: "Build check",

value: caps.staticBuildCheck || "static_only",

ok: true,

},

{

label: "APK build",

value: caps.apkBuild || "external",

ok: true,

},

];

return (

<section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-4 shadow-2xl">

<div className="mb-4 flex items-start justify-between gap-3">

<div>

<h2 className="text-lg font-black text-white">System Status</h2>

<p className="mt-1 text-xs text-zinc-500">

Live backend, memory, AI, GitHub and build engine status.

</p>

</div>

<button

onClick={() => app.handleLiveDiagnostics()}

disabled={app.busy}

className="min-h-10 rounded-2xl bg-white px-4 text-xs font-black text-black disabled:opacity-50 active:scale-[0.98]"

>

Live test

</button>

</div>

<div className="grid grid-cols-2 gap-2 sm:grid-cols-4">

{items.map((item) => (

<div

key={item.label}

className={`rounded-2xl border p-3 ${

item.ok

? "border-emerald-400/20 bg-emerald-500/5"

: "border-yellow-400/20 bg-yellow-500/5"

}`}

>

<p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">

{item.label}

</p>

<p

className={`mt-2 truncate text-xs font-black ${

item.ok ? "text-emerald-200" : "text-yellow-200"

}`}

>

{String(item.value)}

</p>

</div>

))}

</div>

{app.activeJob ? (

<div className="mt-4 rounded-2xl border border-white/10 bg-black/40 p-4">

<p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">

Active project

</p>

<div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">

<Metric label="Score" value={`${app.activeJob.score || 0}/100`} />

<Metric label="Phase" value={app.activeJob.phase || "-"} />

<Metric label="Strategy" value={app.activeJob.strategy || "-"} />

<Metric

label="Mode"

value={app.activeJob.infinite ? "infinite" : "finite"}

/>

</div>

</div>

) : null}

</section>

);

}

function Metric({ label, value }: { label: string; value: string }) {

return (

<div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3">

<p className="truncate text-xs font-black text-white">{value}</p>

<p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-zinc-600">

{label}

</p>

</div>

);

}
