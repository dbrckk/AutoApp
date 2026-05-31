import type { AutoAppState } from "../hooks/useAutoApp";

type ReadinessItem = {

label: string;

ok: boolean;

detail: string;

};

export function BuildReadinessPanel({ app }: { app: AutoAppState }) {

const report = app.projectReport || {};

const build = report.build || {};

const score = report.score || {};

const githubReady = Boolean(app.githubRepo?.trim());

const hasFiles = Boolean(app.files?.length);

const androidReady = Number(score.androidReady || 0) >= 75;

const webReady = Boolean(build.ok) && hasFiles && Number(score.total || 0) >= 75;

const items: ReadinessItem[] = [

{

label: "Files",

ok: hasFiles,

detail: hasFiles

? `${app.files.length} files loaded`

: "No project files loaded",

},

{

label: "Static build",

ok: Boolean(build.ok),

detail: build.ok

? "Static build check passes"

: "Run build check or repair current project",

},

{

label: "Score",

ok: Number(score.total || app.activeJob?.score || 0) >= 75,

detail: `${Number(score.total || app.activeJob?.score || 0)}/100`,

},

{

label: "GitHub",

ok: githubReady,

detail: githubReady

? app.githubRepo

: "Set owner/repo before GitHub export",

},

{

label: "Memory",

ok: Boolean(report.memory),

detail: report.memory

? "Project memory loaded"

: "Open project report after a cycle",

},

{

label: "Quality gate",

ok: Boolean(report.qualityGate?.enabled),

detail: report.qualityGate?.enabled

? "Anti-noise export gate active"

: "Quality gate not reported yet",

},

{

label: "Web deploy",

ok: webReady,

detail: webReady

? "Ready for Vercel/Cloudflare Pages build"

: "Needs files, score 75+, and build check",

},

{

label: "Android",

ok: androidReady,

detail: androidReady

? "Capacitor/Android readiness acceptable"

: "Android packaging still incomplete or not loaded",

},

];

const readyCount = items.filter((item) => item.ok).length;

const percent = Math.round((readyCount / items.length) * 100);

return (

<section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-4 shadow-2xl">

<div className="mb-4 flex items-start justify-between gap-3">

<div>

<h2 className="text-lg font-black text-white">Release Readiness</h2>

<p className="mt-1 text-xs text-zinc-500">

Build, deploy, GitHub, memory and Android readiness.

</p>

</div>

<div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-right">

<p className="text-xl font-black text-white">{percent}%</p>

<p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600">

ready

</p>

</div>

</div>

<div className="mb-4 h-3 overflow-hidden rounded-full bg-white/10">

<div

className={`h-full rounded-full ${

percent >= 85

? "bg-emerald-400"

: percent >= 60

? "bg-yellow-300"

: "bg-red-400"

}`}

style={{ width: `${percent}%` }}

/>

</div>

<div className="grid gap-2">

{items.map((item) => (

<article

key={item.label}

className={`rounded-2xl border p-3 ${

item.ok

? "border-emerald-400/20 bg-emerald-500/5"

: "border-white/10 bg-black/40"

}`}

>

<div className="flex items-start justify-between gap-3">

<div>

<p className="text-xs font-black text-white">{item.label}</p>

<p className="mt-1 text-xs leading-5 text-zinc-500">

{item.detail}

</p>

</div>

<span

className={`rounded-full px-2 py-1 text-[10px] font-black ${

item.ok

? "bg-emerald-400/10 text-emerald-200"

: "bg-zinc-700/50 text-zinc-300"

}`}

>

{item.ok ? "ok" : "todo"}

</span>

</div>

</article>

))}

</div>

<div className="mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-500/5 p-4">

<p className="text-xs font-black text-cyan-200">Next best action</p>

<p className="mt-1 text-xs leading-5 text-cyan-100/70">

{getNextAction(items, app)}

</p>

</div>

</section>

);

}

function getNextAction(items: ReadinessItem[], app: AutoAppState) {

const missing = items.find((item) => !item.ok);

if (!missing) {

return "Project is ready for manual GitHub export and real deployment build.";

}

if (missing.label === "Files") {

return "Open or generate an autonomous project first.";

}

if (missing.label === "Static build") {

return "Run Build Check, then repair any missing imports or dependency issues.";

}

if (missing.label === "Score") {

return "Run one or more autonomous improvement cycles until score reaches at least 75.";

}

if (missing.label === "GitHub") {

return "Set GitHub repo as owner/repo before exporting.";

}

if (missing.label === "Memory") {

return app.activeJobId

? "Refresh the project report after the next cycle."

: "Open an active project to load its memory report.";

}

if (missing.label === "Android") {

return "Let packaging/finalization run, then build APK/AAB outside Cloudflare Worker.";

}

return `Fix readiness item: ${missing.label}.`;

  }
