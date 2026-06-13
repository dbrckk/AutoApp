import type { AutoAppState } from "../hooks/useAutoApp";

export function DeploymentPanel({app}:{app:AutoAppState}){
 const ready=Number(app.projectReport?.professional?.score||0)>=85;
 const checks=[
  ["Build",Boolean(app.projectReport?.build?.ok)],
  ["Pipeline",Boolean(app.pipelineResult)],
  ["Company Brain",Boolean(app.companyBrainResult)],
  ["Workspace",Boolean(app.liveWorkspaceResult)],
  ["GitHub",Boolean(app.githubRepo)],
 ];
 return (
<section className="glass-panel rounded-[2rem] p-5">
<h2 className="text-2xl font-black text-white">Deployment Center</h2>
<p className="mt-2 text-sm text-slate-500">Release readiness and publication checklist.</p>
<div className="mt-5 grid gap-3 md:grid-cols-2">
{checks.map(([l,v])=><div key={String(l)} className="soft-card rounded-2xl p-4 flex justify-between"><span>{l}</span><span>{v?"✅":"⚠️"}</span></div>)}
</div>
<div className="mt-5 rounded-3xl border border-white/10 bg-black/25 p-4">
<p className="text-sm font-black text-white">{ready?"Ready for deployment":"Deployment not recommended yet"}</p>
<p className="mt-2 text-xs text-slate-400">Validate build, run quality gate, create workspace snapshot and publish through GitHub/Cloudflare.</p>
</div>
<div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
<button onClick={app.handlePipelineQuality} className="rounded-2xl bg-violet-500/10 p-3 text-xs font-black">Quality</button>
<button onClick={app.handlePipelineAutofix} className="rounded-2xl bg-emerald-500/10 p-3 text-xs font-black">Autofix</button>
<button onClick={app.handleExportZip} className="rounded-2xl bg-cyan-500/10 p-3 text-xs font-black">Export ZIP</button>
<button onClick={()=>app.handleImproveJob(app.activeJobId)} className="rounded-2xl bg-white text-black p-3 text-xs font-black">Improve</button>
</div>
</section>);
}
