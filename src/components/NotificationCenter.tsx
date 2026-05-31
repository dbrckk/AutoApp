import type { AutoAppState } from "../hooks/useAutoApp";

export function NotificationCenter({ app }: { app: AutoAppState }) {

const notifications = app.notifications || [];

if (!notifications.length) return null;

return (

<div className="fixed right-3 top-[126px] z-50 grid w-[calc(100vw-1.5rem)] max-w-sm gap-2">

{notifications.slice(0, 4).map((item) => (

<article

key={item.id}

className={`rounded-2xl border p-3 shadow-2xl backdrop-blur-xl ${

item.type === "error"

? "border-red-400/20 bg-red-950/80"

: item.type === "success"

? "border-emerald-400/20 bg-emerald-950/80"

: item.type === "warning"

? "border-yellow-400/20 bg-yellow-950/80"

: "border-white/10 bg-black/90"

}`}

>

<div className="flex items-start justify-between gap-3">

<div>

<p className="text-xs font-black text-white">{item.title}</p>

{item.message ? (

<p className="mt-1 text-xs leading-5 text-zinc-300">

{item.message}

</p>

) : null}

</div>

<button

onClick={() => app.dismissNotification(item.id)}

className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-black text-white active:scale-[0.96]"

>

×

</button>

</div>

</article>

))}

</div>

);

}
