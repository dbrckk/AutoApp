import type { AutoAppState } from "../hooks/useAutoApp";

type DiffItem = {
  path: string;
  status: string;
  beforeLines?: number;
  afterLines?: number;
  lineDelta?: number;
  charDelta?: number;
  summary?: string;
};

export function WorkspaceDiffPanel({ app }: { app: AutoAppState }) {
  const snapshot = app.liveWorkspaceResult?.snapshot;
  const diff = snapshot?.diff || null;
  const refactor = snapshot?.refactorPlan || null;
  const quality = snapshot?.quality || null;
  const changedFiles: DiffItem[] =
    diff?.diffs?.filter((item: DiffItem) => item.status !== "unchanged") || [];

  return (
    <section className="glass-panel rounded-[2rem] p-5">
      <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-200">
            Workspace Diff
          </p>

          <h2 className="mt-2 text-2xl font-black tracking-tight text-white">
            Current vs improved project state
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Inspect modified files, refactor ROI, quality score and recommended
            workspace action before continuing autonomous improvement.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={app.handleLiveWorkspaceSnapshot}
            disabled={app.busy || !app.files.length}
            className="min-h-10 rounded-2xl border border-cyan-400/25 bg-cyan-500/10 px-4 text-xs font-black text-cyan-200 disabled:opacity-50"
          >
            Refresh diff
          </button>

          <button
            onClick={() => app.handleImproveJob(app.activeJobId)}
            disabled={app.busy || !app.activeJobId}
            className="min-h-10 rounded-2xl border border-white/10 bg-white px-4 text-xs font-black text-black disabled:opacity-50"
          >
            Improve
          </button>
        </div>
      </div>

      {snapshot ? (
        <div className="grid gap-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Metric label="Quality" value={quality?.total ?? 0} suffix="/100" />
            <Metric label="ROI" value={refactor?.roi ?? 0} suffix="/100" />
            <Metric label="Impact" value={refactor?.impact ?? 0} suffix="/100" />
            <Metric label="Risk" value={refactor?.risk ?? 0} suffix="/100" />
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/25 p-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <p className="text-sm font-black text-white">
                  Refactor decision
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  {refactor?.reason || "No refactor reason available."}
                </p>
              </div>

              <div className="grid min-w-[180px] gap-2 rounded-2xl border border-white/10 bg-white/[0.035] p-3">
                <Info label="Action" value={refactor?.action || "none"} />
                <Info label="Target" value={refactor?.targetPath || "none"} />
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Metric label="Changed files" value={diff?.changedFiles ?? changedFiles.length} />
            <Metric label="Added" value={diff?.added ?? 0} />
            <Metric label="Modified" value={diff?.modified ?? 0} />
            <Metric label="Deleted" value={diff?.deleted ?? 0} />
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/25 p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-black text-white">Changed files</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Files detected by the Live Workspace diff engine.
                </p>
              </div>

              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                {changedFiles.length} files
              </span>
            </div>

            {changedFiles.length ? (
              <div className="grid gap-2">
                {changedFiles.slice(0, 40).map((item) => (
                  <article
                    key={`${item.status}-${item.path}`}
                    className="rounded-2xl border border-white/10 bg-white/[0.035] p-3"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${statusClass(item.status)}`}>
                            {item.status}
                          </span>
                          <span className="break-all text-sm font-black text-white">
                            {item.path}
                          </span>
                        </div>

                        <p className="mt-2 text-xs leading-5 text-slate-500">
                          {item.summary || "File content changed."}
                        </p>
                      </div>

                      <div className="grid shrink-0 grid-cols-3 gap-2 text-center">
                        <SmallStat label="Before" value={item.beforeLines ?? 0} />
                        <SmallStat label="After" value={item.afterLines ?? 0} />
                        <SmallStat label="Delta" value={item.lineDelta ?? 0} />
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.025] p-6 text-center">
                <p className="font-black text-white">No diff available</p>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  A diff appears after the workspace snapshot receives both
                  previous and current files.
                </p>
              </div>
            )}
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <ContextList title="Important files" items={snapshot.importantPaths || []} />
            <ContextList title="Neighbor files" items={snapshot.neighborPaths || []} />
          </div>
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.025] p-8 text-center">
          <p className="text-lg font-black text-white">No workspace diff loaded</p>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
            Run a Live Workspace snapshot after opening or generating files to
            compute context, ROI and file differences.
          </p>

          <button
            onClick={app.handleLiveWorkspaceSnapshot}
            disabled={app.busy || !app.files.length}
            className="mt-5 min-h-11 rounded-2xl border border-cyan-400/25 bg-cyan-500/10 px-4 text-xs font-black text-cyan-200 disabled:opacity-50"
          >
            Create snapshot
          </button>
        </div>
      )}
    </section>
  );
}

function Metric({
  label,
  value,
  suffix = "",
}: {
  label: string;
  value: number;
  suffix?: string;
}) {
  return (
    <div className="soft-card rounded-2xl p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-3xl font-black text-white">
        {Math.round(Number(value) || 0)}
        <span className="text-sm text-slate-500">{suffix}</span>
      </p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 break-all text-sm font-black text-white">{value}</p>
    </div>
  );
}

function SmallStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
      <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-black text-white">{value}</p>
    </div>
  );
}

function ContextList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/25 p-4">
      <p className="text-sm font-black text-white">{title}</p>

      <div className="mt-3 grid gap-2">
        {(items.length ? items : ["none"]).slice(0, 12).map((item) => (
          <div
            key={item}
            className="break-all rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2 text-xs leading-5 text-slate-300"
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function statusClass(status: string) {
  if (status === "added") return "border-emerald-400/20 bg-emerald-500/10 text-emerald-200";
  if (status === "deleted") return "border-red-400/20 bg-red-500/10 text-red-200";
  if (status === "modified") return "border-yellow-400/20 bg-yellow-500/10 text-yellow-200";
  return "border-slate-400/20 bg-slate-500/10 text-slate-200";
              }
                            
