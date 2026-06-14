import type { AutoAppState } from "../hooks/useAutoApp";

export function ReleaseChecklistPanel({ app }: { app: AutoAppState }) {

const commands = [

"npm install",

"npm run build",

"npm run preview",

"git add .",

'git commit -m "release candidate"',

"git push",

];

const androidCommands = [

"npm run build",

"npm install @capacitor/core @capacitor/cli @capacitor/android",

"npx cap add android",

"npx cap sync android",

"npx cap open android",

];

return (

<section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-4 shadow-2xl">

<div className="mb-4">

<h2 className="text-lg font-black text-white">Release Checklist</h2>

<p className="mt-1 text-xs text-zinc-500">

Manual commands for real build and release validation.

</p>

</div>

<Checklist

title="Web deployment"

items={[

"Export project to GitHub.",

"Let Vercel or Cloudflare Pages run a real npm build.",

"Open deployed URL on mobile.",

"Test Start, Step, Improve, Export ZIP and GitHub.",

"Check console for runtime errors.",

]}

/>

<CommandBlock title="Web commands" commands={commands} />

<Checklist

title="Android deployment"

items={[

"Do not build APK inside Cloudflare Worker.",

"Use Android Studio or a real CI Android runner.",

"Configure app icon, app id and signing key.",

"Test on a physical Android phone.",

"Generate AAB for Play Store release.",

]}

/>

<CommandBlock title="Android commands" commands={androidCommands} />

<div className="mt-4 rounded-2xl border border-white/10 bg-black/40 p-4">

<p className="text-xs font-black text-white">Current repo</p>

<p className="mt-1 break-all text-xs text-zinc-500">

{app.githubRepo || "No repo configured"}

</p>

</div>

</section>

);

}

function Checklist({ title, items }: { title: string; items: string[] }) {

return (

<div className="mb-4">

<h3 className="mb-2 text-xs font-black uppercase tracking-[0.22em] text-zinc-500">

{title}

</h3>

<div className="grid gap-2">

{items.map((item) => (

<div

key={item}

className="rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-xs leading-5 text-zinc-300"

>

{item}

</div>

))}

</div>

</div>

);

}

function CommandBlock({

title,

commands,

}: {

title: string;

commands: string[];

}) {

return (

<div className="mb-4 rounded-2xl border border-white/10 bg-black/60 p-4">

<p className="mb-3 text-xs font-black uppercase tracking-[0.22em] text-zinc-500">

{title}

</p>

<pre className="overflow-auto whitespace-pre-wrap text-xs leading-6 text-zinc-300">

{commands.join("\n")}

</pre>

</div>

);

  }
