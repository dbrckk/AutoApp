import type { AutoAppState } from "../hooks/useAutoApp";

export function SessionRecoveryPanel({ app }: { app: AutoAppState }) {

if (!app.sessionSnapshotAvailable) return null;

return (

<section className="rounded-[2rem] border border-cyan-400/20 bg-cyan-500/5 p-4 shadow-2xl">

<div className="flex items-start justify-between gap-3">

<div>

<h2 className="text-lg font-black text-white">Recover session</h2>

<p className="mt-1 text-xs leading-5 text-cyan-100/70">

A recent local frontend snapshot is available. Restore it if the page was refreshed or the UI crashed.

</p>

</div>

<span className="rounded-full bg-cyan-400/10 px-3 py-1 text-[10px] font-black text-cyan-200">

local

</span>

</div>

<div className="mt-4 grid gap-2 sm:grid-cols-2">

<button

onClick={app.restoreFrontendSnapshot}

className="min-h-12 rounded-2xl bg-white px-4 text-sm font-black text-black active:scale-[0.98]"

>

Restore

</button>

<button

onClick={app.dismissFrontendSnapshot}

className="min-h-12 rounded-2xl border border-white/10 bg-black/40 px-4 text-sm font-black text-white active:scale-[0.98]"

>

Dismiss

</button>

</div>

</section>

);

}
