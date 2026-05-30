import type { AutoAppState } from "../hooks/useAutoApp";

export function TopStatusBar({ app }: { app: AutoAppState }) {

return (

<header className="fixed left-0 right-0 top-0 z-40 border-b border-white/10 bg-black/90 px-3 py-3 backdrop-blur-xl">

<div className="mx-auto flex max-w-7xl items-center justify-between gap-3">

<div className="min-w-0">

<div className="flex items-center gap-2">

<div

className={`h-2.5 w-2.5 rounded-full ${

app.busy ? "animate-pulse bg-yellow-300" : "bg-emerald-400"

}`}

/>

<p className="truncate text-sm font-black text-white">

{app.busy ? "Working" : "AutoApp"}

</p>

</div>

<p className="mt-0.5 line-clamp-1 text-xs text-zinc-400">

{app.status}

</p>

</div>

<div className="flex shrink-0 items-center gap-2">

{app.activeJob ? (

<div className="hidden rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-right sm:block">

<p className="text-xs font-black text-white">

{app.activeJob.score || 0}/100

</p>

<p className="text-[10px] text-zinc-500">{app.activeJob.phase}</p>

</div>

) : null}

<button

onClick={() => app.handleLiveDiagnostics()}

disabled={app.busy}

className="min-h-10 rounded-2xl bg-white px-4 text-xs font-black text-black disabled:opacity-50 active:scale-[0.98]"

>

Live test

</button>

</div>

</div>

</header>

);

}
