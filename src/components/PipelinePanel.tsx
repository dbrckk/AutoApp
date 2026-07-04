import type { AutoAppState } from "../hooks/useAutoApp";

export function PipelinePanel({ app }: { app: AutoAppState }) {
  const pipeline = app.pipelineResult || {};
  const quality = pipeline.quality || app.projectReport?.quality || null;
  const categories = Object.entries(quality?.categories || {}) as [string, number][];

  return (
    <section className="glass-panel rounded-[2rem] p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-violet-200">Quality Engine</p>
          <h2 className="mt-2 text-xl font-black text-white">Professional pipeline</h2>
          <p className="mt-1 text-sm text-slate-500">Plan, inspect, repair and continuously improve the active project.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Action onClick={app.handlePipelinePlan} disabled={app.busy}>Plan</Action>
          <Action onClick={app.handlePipelineQuality} disabled={app.busy || !app.files.length}>Quality</Action>
          <Action primary onClick={app.handlePipelineAutofix} disabled={app.busy || !app.files.length}>Autofix</Action>
        </div>
      </div>

      {quality ? (
        <div className="mt-5 grid gap-4">
          <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
            <div className="flex items-end justify-between gap-4">
              <div><p className="text-sm font-black text-white">Pipeline score</p><p className="mt-1 text-xs text-slate-500">{pipeline.focus ? `Focus: ${pipeline.focus}` : "Quality gate"}</p></div>
              <p className="text-3xl font-black text-white">{Number(quality.total || 0)}<span className="text-sm text-slate-500">/100</span></p>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-violet-500" style={{ width: `${clamp(Number(quality.total || 0))}%` }} /></div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {categories.map(([key, value]) => (
              <div key={key} className="soft-card rounded-2xl p-3">
                <div className="flex items-center justify-between gap-3"><p className="truncate text-xs font-black uppercase tracking-[0.12em] text-slate-500">{formatLabel(key)}</p><p className="text-sm font-black text-white">{Number(value)}/100</p></div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-white/70" style={{ width: `${clamp(Number(value))}%` }} /></div>
              </div>
            ))}
          </div>

          <IssueList title="Blockers" items={quality.blockers || []} tone="danger" />
          <IssueList title="Warnings" items={quality.warnings || []} tone="warning" />
          <IssueList title="Next improvements" items={quality.suggestions || []} tone="neutral" />
        </div>
      ) : (
        <div className="mt-5 rounded-3xl border border-dashed border-white/15 bg-white/[0.025] p-6 text-center"><p className="font-black text-white">No quality run yet</p><p className="mt-2 text-sm text-slate-500">Open a project, then run Quality or Autofix.</p></div>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <IntelligenceCard title="Company Brain" description="Analyze goals, risks, memory and the next best move." action="Analyze" onClick={app.handleAnalyzeCompanyBrain} disabled={app.busy} />
        <IntelligenceCard title="Live Workspace" description="Capture changed files and the current build context." action="Snapshot" onClick={app.handleLiveWorkspaceSnapshot} disabled={app.busy || !app.files.length} />
      </div>
    </section>
  );
}

function Action({ children, onClick, disabled, primary }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; primary?: boolean }) {
  return <button onClick={onClick} disabled={disabled} className={`min-h-10 rounded-2xl border px-4 text-xs font-black transition disabled:opacity-40 ${primary ? "border-violet-400/30 bg-violet-500/15 text-violet-100" : "border-white/10 bg-white/[0.05] text-white"}`}>{children}</button>;
}

function IssueList({ title, items, tone }: { title: string; items: string[]; tone: "danger" | "warning" | "neutral" }) {
  if (!items.length) return null;
  const classes = tone === "danger" ? "border-red-400/20 bg-red-500/10 text-red-200" : tone === "warning" ? "border-yellow-400/20 bg-yellow-500/10 text-yellow-100" : "border-violet-400/20 bg-violet-500/10 text-violet-100";
  return <div><p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{title}</p><div className="grid gap-2">{items.slice(0, 8).map((item) => <div key={item} className={`rounded-2xl border px-3 py-2 text-xs leading-5 ${classes}`}>{item}</div>)}</div></div>;
}

function IntelligenceCard({ title, description, action, onClick, disabled }: { title: string; description: string; action: string; onClick: () => void; disabled?: boolean }) {
  return <article className="soft-card rounded-3xl p-4"><p className="text-sm font-black text-white">{title}</p><p className="mt-2 min-h-10 text-xs leading-5 text-slate-500">{description}</p><button onClick={onClick} disabled={disabled} className="mt-4 min-h-10 w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-xs font-black text-white disabled:opacity-40">{action}</button></article>;
}

function formatLabel(value: string) { return value.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " "); }
function clamp(value: number) { return Math.max(0, Math.min(100, value)); }
