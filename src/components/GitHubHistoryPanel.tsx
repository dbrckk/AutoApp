import type { AutoAppState } from "../hooks/useAutoApp";

import { ActionButton } from "./ActionButton";

import { Panel } from "./Panel";

export function GitHubHistoryPanel({ app }: { app: AutoAppState }) {

return (

<Panel

title="GitHub History"

subtitle="Latest real commits from the selected GitHub repository."

>

<div className="grid gap-3">

<ActionButton

onClick={app.handleLoadGitHubHistory}

disabled={app.busy || !app.githubRepo.trim()}

>

Load GitHub history

</ActionButton>

<div className="max-h-[340px] overflow-auto rounded-2xl border border-white/10 bg-black/40 p-2">

{app.githubHistory.length ? (

app.githubHistory.map((commit) => (

<article

key={commit.sha}

className="mb-2 rounded-xl border border-white/10 bg-white/[0.03] p-3"

>

<p className="line-clamp-2 text-sm font-bold text-white">

{commit.message || "No commit message"}

</p>

<p className="mt-1 text-xs text-zinc-500">

{commit.author} · {commit.date ? new Date(commit.date).toLocaleString() : "unknown date"}

</p>

<p className="mt-1 break-all text-xs text-zinc-600">

{commit.sha}

</p>

{commit.url ? (

<a

href={commit.url}

target="_blank"

rel="noreferrer"

className="mt-3 inline-block rounded-xl bg-white px-3 py-2 text-xs font-black text-black"

>

Open commit

</a>

) : null}

</article>

))

) : (

<p className="p-3 text-sm text-zinc-500">

No GitHub history loaded yet.

</p>

)}

</div>

</div>

</Panel>

);

}
