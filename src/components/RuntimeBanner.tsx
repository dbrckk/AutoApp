import type { AutoAppState } from "../hooks/useAutoApp";

export function RuntimeBanner({ app }: { app: AutoAppState }) {

const isOffline =

typeof navigator !== "undefined" && navigator.onLine === false;

const hasErrorStatus =

typeof app.status === "string" &&

/error|failed|missing|invalid|crash/i.test(app.status);

if (!isOffline && !hasErrorStatus && !app.busy) {

return null;

}

return (

<div className="fixed left-3 right-3 top-[74px] z-50 mx-auto max-w-3xl rounded-2xl border border-white/10 bg-black/90 p-3 shadow-2xl backdrop-blur-xl">

<div className="flex items-start justify-between gap-3">

<div>

<p

className={`text-xs font-black ${

isOffline

? "text-yellow-200"

: hasErrorStatus

? "text-red-200"

: "text-emerald-200"

}`}

>

{isOffline

? "Offline mode"

: hasErrorStatus

? "Attention required"

: "Working"}

</p>

<p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-400">

{isOffline

? "Network is unavailable. Local UI remains usable, remote actions may fail."

: app.status}

</p>

</div>

{app.busy ? (

<span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-emerald-300" />

) : null}

</div>

</div>

);

}
