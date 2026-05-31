import type { AutoAppState } from "../hooks/useAutoApp";

export function QuickActionsPanel({ app }: { app: AutoAppState }) {

const hasProject = Boolean(app.activeJobId);

const hasFiles = Boolean(app.files?.length);

const hasRepo = Boolean(app.githubRepo?.trim());

const actions = [

{

label: "Start",

description: "Create autonomous project",

disabled: app.busy,

onClick: app.handleStartAutonomous,

primary: true,

},

{

label: "Step",

description: "Run one cycle",

disabled: app.busy || !hasProject,

onClick: app.handleStepJob,

},

{

label: "Resume",

description: "Resume active job",

disabled: app.busy || !hasProject,

onClick: app.handleResumeJob,

},

{

label: "Improve",

description: "Force next improvement",

disabled: app.busy || !hasProject,

onClick: () => app.handleImproveJob(app.activeJobId),

},

{

label: "Report",

description: "Refresh memory/report",

disabled: app.busy || !hasProject,

onClick: () => app.refreshProjectReport(app.activeJobId),

},

{

label: "Live test",

description: "Backend diagnostics",

disabled: app.busy,

onClick: app.handleLiveDiagnostics,

},

{

label: "ZIP",

description: "Download project",

disabled: app.busy || !hasFiles,

onClick: app.handleExportZip,

},

{

label: "GitHub",

description: "Manual export",

disabled: app.busy || !hasFiles || !hasRepo,

onClick: app.handleExportGitHub,

},

];

return (

<section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-4 shadow-2xl">

<div className="mb-4">

<h2 className="text-lg font-black text-white">Quick Actions</h2>

<p className="mt-1 text-xs text-zinc-500">

Fast control surface for autonomous project execution.

</p>

</div>

<div className="grid grid-cols-2 gap-2">

{actions.map((action) => (

<button

key={action.label}

onClick={action.onClick}

disabled={action.disabled}

className={`min-h-20 rounded-2xl border p-3 text-left transition disabled:opacity-40 active:scale-[0.98] ${

action.primary

? "border-white/20 bg-white text-black"

: "border-white/10 bg-black/40 text-white hover:bg-white/10"

}`}

>

<span className="block text-sm font-black">{action.label}</span>

<span

className={`mt-1 block text-xs leading-4 ${

action.primary ? "text-black/60" : "text-zinc-500"

}`}

>

{action.description}

</span>

</button>

))}

</div>

<div className="mt-4 rounded-2xl border border-white/10 bg-black/40 p-3">

<p className="text-xs font-black text-white">Current status</p>

<p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-500">

{app.status}

</p>

</div>

</section>

);

  }
