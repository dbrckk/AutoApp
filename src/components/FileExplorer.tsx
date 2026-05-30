import { useMemo, useState } from "react";

import type { AutoAppState } from "../hooks/useAutoApp";

import { CodeEditor } from "./CodeEditor";

import { EmptyState } from "./EmptyState";

export function FileExplorer({ app }: { app: AutoAppState }) {

const [query, setQuery] = useState("");

const filteredFiles = useMemo(() => {

const q = query.trim().toLowerCase();

if (!q) return app.files;

return app.files.filter((file) =>

`${file.path}\n${file.content || ""}`.toLowerCase().includes(q)

);

}, [app.files, query]);

const selectedIndex = useMemo(

() => filteredFiles.findIndex((file) => file.path === app.selectedFile?.path),

[filteredFiles, app.selectedFile]

);

function updateCurrentFile(content: string) {

if (!app.selectedFile) return;

app.setFiles((previous) =>

previous.map((file) =>

file.path === app.selectedFile?.path ? { ...file, content } : file

)

);

}

return (

<section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] shadow-2xl">

<div className="border-b border-white/10 p-4">

<div className="flex items-start justify-between gap-3">

<div>

<h2 className="text-lg font-black text-white">Editor</h2>

<p className="mt-1 text-xs text-zinc-500">

{app.projectStats.files} files · {app.projectStats.lines} lines ·{" "}

{app.projectStats.chars.toLocaleString()} chars

</p>

</div>

<div className="rounded-full bg-white/10 px-3 py-1 text-xs text-zinc-300">

{selectedIndex >= 0 ? `${selectedIndex + 1}/${filteredFiles.length}` : "0"}

</div>

</div>

<div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">

<input

value={query}

onChange={(event) => setQuery(event.target.value)}

placeholder="Search file or code..."

className="min-h-12 rounded-2xl border border-white/10 bg-black/50 px-4 text-sm text-white outline-none focus:border-white/30"

/>

<button

onClick={() => setQuery("")}

className="min-h-12 rounded-2xl border border-white/10 bg-black/40 px-4 text-sm font-bold text-white active:scale-[0.98]"

>

Clear

</button>

</div>

<div className="mt-3 grid grid-cols-3 gap-2">

<button

onClick={app.handleCreateFile}

className="min-h-11 rounded-2xl border border-white/10 bg-black/40 text-sm font-bold text-white active:scale-[0.98]"

>

New

</button>

<button

onClick={app.handleRenameSelectedFile}

disabled={!app.selectedFile}

className="min-h-11 rounded-2xl border border-white/10 bg-black/40 text-sm font-bold text-white disabled:opacity-40 active:scale-[0.98]"

>

Rename

</button>

<button

onClick={app.handleDeleteSelectedFile}

disabled={!app.selectedFile}

className="min-h-11 rounded-2xl border border-red-400/30 bg-red-500/10 text-sm font-bold text-red-200 disabled:opacity-40 active:scale-[0.98]"

>

Delete

</button>

</div>

</div>

<div className="grid min-h-[70vh] gap-0 lg:grid-cols-[300px_1fr]">

<div className="max-h-[240px] overflow-auto border-b border-white/10 bg-black/30 p-2 lg:max-h-[720px] lg:border-b-0 lg:border-r">

{filteredFiles.length ? (

filteredFiles.map((file) => (

<button

key={file.path}

onClick={() => app.setSelectedPath(file.path)}

className={`mb-1 block w-full rounded-xl px-3 py-2 text-left text-xs transition active:scale-[0.99] ${

app.selectedFile?.path === file.path

? "bg-white text-black"

: "text-zinc-300 hover:bg-white/10"

}`}

>

<span className="block truncate">{file.path}</span>

<span className="mt-1 block text-[10px] opacity-60">

{String(file.content || "").split("\n").length} lines

</span>

</button>

))

) : (

<EmptyState title="No matching files" description="Try another search." />

)}

</div>

<div className="min-h-[520px]">

<CodeEditor file={app.selectedFile} onChange={updateCurrentFile} />

</div>

</div>

</section>

);

  }
