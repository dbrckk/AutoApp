import type { AutoAppState } from "../hooks/useAutoApp";

import { EmptyState } from "./EmptyState";

export function ActivityPanel({ app }: { app: AutoAppState }) {

const events = app.activityEvents || [];

return (

<section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-4 shadow-2xl">

<div className="mb-4 flex items-start justify-between gap-3">

<div>

<h2 className="text-lg font-black text-white">Activity</h2>

<p className="mt-1 text-xs text-zinc-500">

Frontend actions, errors, exports and recovery events.

</p>

</div>

<button

onClick={app.clearActivityEvents}

disabled={!events.length}

className="min-h-10 rounded-2xl border border-white/10 bg-black/40 px-4 text-xs font-black text-white disabled:opacity-40 active:scale-[0.98]"

>

Clear

</button>

</div>

{events.length ? (

<div className="grid gap-2">

{events.slice(0, 20).map((event) => (

<article

key={event.id}

className="rounded-2xl border border-white/10 bg-black/40 p-3"

>

<div className="flex items-start justify-between gap-3">

<p className="text-xs font-black text-white">{event.title}</p>

<span className="shrink-0 text-[10px] text-zinc-600">

{new Date(event.at).toLocaleTimeString()}

</span>

</div>

{event.message ? (

<p className="mt-1 text-xs leading-5 text-zinc-500">

{event.message}

</p>

) : null}

</article>

))}

</div>

) : (

<EmptyState

title="No activity yet"

description="Actions will appear here as the app runs."

/>

)}

</section>

);

  }
