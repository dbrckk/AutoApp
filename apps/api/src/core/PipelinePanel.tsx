import type { AutoAppState } from "../hooks/useAutoApp";

export function PipelinePanel({ app }: { app: AutoAppState }) {
  const pipeline = app.pipelineResult || {};
  const quality = pipeline.quality || app.projectReport?.quality || null;

  return (
    <section className="glass-panel rounded-[2rem] p-5">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-black text-white">Professional Pipeline</h2>
          <p className="mt-1 text-sm text-slate-500">
            Plan, quality gate and autofix engine for generated projects.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={app.handlePipelinePlan}
            disabled={app.busy}
            className="min-h-10 rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-xs font-black text-white disabled:opacity-50"
          >
            Plan
          </button>

          <button
            onClick={app.handlePipelineQuality}
            disabled={app.busy || !app.files.length}
            className="min-h-10 rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-xs font-black text-white disabled:opacity-50"
          >
            Quality
          </button>

          <button
            onClick={app.handlePipelineAutofix}
            disabled={app.busy || !app.files.length}
            className="min-h-10 rounded-2xl border border-violet-400/25 bg-violet-500/10 px-4 text-xs font-black text-violet-200 disabled:opacity-50"
          >
            Autofix
          </button>
        </div>
      </div>

      {quality ? (
        <div className="grid gap-3">
          <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-black text-white">Pipeline score</p>
                <p className="mt-1 text-xs text-slate-500">
                  {pipeline.focus ? "Focus: " + pipeline.focus : "Quality gate"}
                </p>
              </div>

              <div className="text-right">
                <p className="text-3xl font-black text-white">
                  {quality.total || 0}
                </p>
                <p className="text-xs text-slate-500">/100</p>
              </div>
            </div>

            <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-violet-500"
                style={{ width: `${Math.max(0, Math.min(100, quality.total || 0))}%` }}
              />
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {Object.entries(quality.categories || {}).map(([key, value]) => (
              <div
                key={key}
                className="rounded-2xl border border-white/10 bg-white/[0.035] p-3"
              >
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                  {key}
                </p>
                <p className="mt-2 text-lg font-black text-white">
                  {String(value)}/100
                </p>
              </div>
            ))}
          </div>

          <IssueList title="Blockers" items={quality.blockers || []} tone="red" />
          <IssueList title="Warnings" items={quality.warnings || []} tone="yellow" />
          <IssueList title="Suggestions" items={quality.suggestions || []} tone="violet" />
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.025] p-8 text-center">
          <p className="font-black text-white">No pipeline result yet</p>
          <p className="mt-2 text-sm text-slate-500">
            Run plan or quality check after opening/generated files.
          </p>
        </div>
      )}
    </section>
  );
}

function IssueList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "red" | "yellow" | "violet";
}) {
  const color =
    tone === "red"
      ? "text-red-200 border-red-400/20 bg-red-500/10"
      : tone === "yellow"
      ? "text-yellow-200 border-yellow-400/20 bg-yellow-500/10"
      : "text-violet-200 border-violet-400/20 bg-violet-500/10";

  return (
    <div>
      <p className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-slate-500">
        {title}
      </p>

      <div className="grid gap-2">
        {(items.length ? items : ["none"]).slice(0, 8).map((item) => (
          <div
            key={item}
            className={`rounded-2xl border px-3 py-2 text-xs leading-5 ${color}`}
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  );
            }
                    
