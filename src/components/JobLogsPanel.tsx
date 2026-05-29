import type { AutoAppState } from "../hooks/useAutoApp";

import { ActionButton } from "./ActionButton";

import { Panel } from "./Panel";

export function JobLogsPanel({ app }: { app: AutoAppState }) {

return (

<Panel

title="Job Logs"

subtitle="Real D1 logs from the selected autonomous project."

>

<div className="mb-4 grid gap-3 md:grid-cols-2">

<ActionButton

onClick={() => app.handleLoadJobLogs()}

disabled={app.busy || !app.activeJobId}

>

Refresh logs

</ActionButton>

<ActionButton

onClick={() => app.handleImproveJob()}

disabled={app.busy || !app.activeJobId}

variant="primary"

>

Relaunch improve

</ActionButton>

</div>

<div className="max-h-[420px] overflow-auto rounded-2xl border border-white/10 bg-black/60 p-4">

{app.jobLogs.length ? (

<div className="grid gap-2">

{app.jobLogs.map((log, index) => (

<p

key={`${index}-${log}`}

className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs leading-5 text-zinc-300"

>

{log}

</p>

))}

</div>

) : (

<p className="text-sm text-zinc-500">

No logs loaded. Select a project, then click Refresh logs.

</p>

)}

</div>

</Panel>

);

}
