export function StatusBadge({

value,

tone,

}: {

value: string;

tone?: "good" | "warn" | "bad" | "info" | "neutral";

}) {

const normalized = String(value || "unknown").toLowerCase();

const resolvedTone =

tone ||

(normalized.includes("done") || normalized.includes("success") || normalized.includes("real")

? "good"

: normalized.includes("error") || normalized.includes("failed") || normalized.includes("missing")

? "bad"

: normalized.includes("paused") || normalized.includes("warning")

? "warn"

: normalized.includes("running") || normalized.includes("working")

? "info"

: "neutral");

const classes = {

good: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",

warn: "border-amber-400/30 bg-amber-500/10 text-amber-200",

bad: "border-red-400/30 bg-red-500/10 text-red-200",

info: "border-sky-400/30 bg-sky-500/10 text-sky-200",

neutral: "border-white/10 bg-white/10 text-zinc-300",

};

return (

<span

className={`inline-flex max-w-full items-center rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-wide ${classes[resolvedTone]}`}

>

<span className="truncate">{value || "unknown"}</span>

</span>

);

}
