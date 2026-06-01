import type { ReactNode } from "react";

export function MobileScreen({

title,

subtitle,

actions,

children,

}: {

title: string;

subtitle?: string;

actions?: ReactNode;

children: ReactNode;

}) {

return (

<section className="space-y-4">

<div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.02] p-5 shadow-2xl">

<div className="flex items-start justify-between gap-4">

<div>

<p className="text-xs font-black uppercase tracking-[0.22em] text-zinc-500">

AutoApp

</p>

<h1 className="mt-2 text-2xl font-black tracking-tight text-white md:text-4xl">

{title}

</h1>

{subtitle ? (

<p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">

{subtitle}

</p>

) : null}

</div>

{actions ? <div className="shrink-0">{actions}</div> : null}

</div>

</div>

{children}

</section>

);

}
