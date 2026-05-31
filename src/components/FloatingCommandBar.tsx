import type { AutoAppState } from "../hooks/useAutoApp";

export function FloatingCommandBar({ app }: { app: AutoAppState }) {

const hasProject = Boolean(app.activeJobId);

return (

<div className="fixed bottom-24 left-3 right-3 z-30 mx-auto max-w-lg rounded-[1.5rem] border border-white/10 bg-black/85 p-2 shadow-2xl backdrop-blur-xl lg:hidden">

<div className="grid grid-cols-4 gap-1">

<button

onClick={app.handleStartAutonomous}

disabled={app.busy}

className="min-h-11 rounded-2xl bg-white px-2 text-[11px] font-black text-black disabled:opacity-40 active:scale-[0.96]"

>

Start

</button>

<button

onClick={app.handleStepJob}

disabled={app.busy || !hasProject}

className="min-h-11 rounded-2xl border border-white/10 bg-white/5 px-2 text-[11px] font-black text-white disabled:opacity-40 active:scale-[0.96]"

>

Step

</button>

<button

onClick={() => app.handleImproveJob(app.activeJobId)}

disabled={app.busy || !hasProject}

className="min-h-11 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-2 text-[11px] font-black text-emerald-200 disabled:opacity-40 active:scale-[0.96]"

>

Improve

</button>

<button

onClick={app.handleLiveDiagnostics}

disabled={app.busy}

className="min-h-11 rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-2 text-[11px] font-black text-cyan-200 disabled:opacity-40 active:scale-[0.96]"

>

Test

</button>

</div>

</div>

);

}
