import type { AutoAppState } from "../hooks/useAutoApp";

export function LiveWorkspacePanel({ app }: { app: AutoAppState }) {
  const snapshot = app.liveWorkspaceResult?.snapshot;

  return (
    <section className="glass-panel rounded-[2rem] p-5">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-200">
            Live Workspace
          </p>
          <h2 className="mt-2 text-xl font-black text-white">
            Context, refactor plan and diff
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Cursor-like workspace context for autonomous product edits.
          </p>
        </div>

        <button
          onClick={app.handleLiveWorkspaceSnapshot}
          disabled={app.busy || !app.files.length}
          className="min-h-10 rounded-2xl border border-cyan-400/25 bg-cyan-500/10 px-4 text-xs font-black text-cyan-200 disabled:opacity-50"
        >
          Snapshot
        </button>
      </div>

      {snapshot ? (
        <div className="grid gap-4">
          <div className="grid gap-3 md:grid-cols-4">
            <Metric label="Quality" value={snapshot.quality?.total || 0} />
            <Metric label="ROI" value={snapshot.refactorPlan?.roi || 0} />
            <Metric label="Impact" value={snapshot.refactorPlan?.impact || 0} />
            <Metric label="Risk" value={snapshot.refactorPlan?.risk || 0} />
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/25 p-4">
            <p className="text-sm font-black text-white">Refactor Plan</p>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              {snapshot.refactorPlan?.reason}
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Info label="Target" value={snapshot.refactorPlan?.targetPath || "-"} />
              <Info label="Action" value={snapshot.refactorPlan?.action || "-"} />
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/25 p-4">
            <p className="text-sm font-black text-white">Selected Context</p>
            <p className="mt-2 break-all text-sm text-slate-400">
              {snapshot.selectedFilePath || "none"}
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.025] p-8 text-center">
          <p className="font-black text-white">No workspace snapshot yet</p>
          <p className="mt-2 text-sm text-slate-500">
            Open files and run Snapshot to build the live editing context.
          </p>
        </div>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="soft-card rounded-2xl p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-3xl font-black text-white">{value}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 break-all text-sm font-bold text-white">{value}</p>
    </div>
  );
              }
            
