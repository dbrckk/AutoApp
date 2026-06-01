import { ActionButton } from "./ActionButton";

export function EmptyState({

title,

message,

actionLabel,

onAction,

}: {

title: string;

message: string;

actionLabel?: string;

onAction?: () => void;

}) {

return (

<div className="rounded-3xl border border-dashed border-white/10 bg-black/30 p-6 text-center">

<p className="text-base font-black text-white">{title}</p>

<p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-zinc-500">{message}</p>

{actionLabel && onAction ? (

<div className="mt-4">

<ActionButton onClick={onAction} variant="primary">

{actionLabel}

</ActionButton>

</div>

) : null}

</div>

);

}
