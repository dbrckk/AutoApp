import type { AutoAppState } from "../hooks/useAutoApp";

export function CompanyBrainPanel({ app }: { app: AutoAppState }) {
  const brain = app.companyBrainResult?.brain || app.projectReport?.professional?.companyBrain;

  return (
    <section className="glass-panel rounded-[2rem] p-5">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-200">
            Company Brain
          </p>
          <h2 className="mt-2 text-xl font-black text-white">
            Autonomous product memory
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Product memory, current mission, backlog, decisions and KPIs.
          </p>
        </div>

        <button
          onClick={app.handleAnalyzeCompanyBrain}
          disabled={app.busy}
          className="min-h-10 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-4 text-xs font-black text-emerald-200 disabled:opacity-50"
        >
          Analyze
        </button>
      </div>

      {brain ? (
        <div className="grid gap-4">
          <div className="rounded-3xl border border-white/10 bg-black/25 p-4">
            <p className="text-sm font-black text-white">Vision</p>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              {brain.memory?.vision || "No vision loaded."}
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Metric title="Overall KPI" value={brain.kpis?.overall || 0} />
            <Metric title="Quality" value={brain.quality?.total || 0} />
            <Metric title="UX" value={brain.kpis?.ux || 0} />
            <Metric title="Autonomy" value={brain.kpis?.autonomy || 0} />
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/25 p-4">
            <p className="text-sm font-black text-white">Current Mission</p>
            <p className="mt-2 text-lg font-black text-white">
              {brain.mission?.title || "No mission"}
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-400">
              {brain.mission?.objective || "No objective loaded."}
            </p>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <List title="Strengths" items={brain.memory?.strengths || []} />
            <List title="Weaknesses" items={brain.memory?.weaknesses || []} />
          </div>

          <div>
            <p className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-slate-500">
              Backlog
            </p>
            <div className="grid gap-2">
              {(brain.backlog || []).slice(0, 8).map((mission: any) => (
                <div
                  key={mission.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.035] p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-black text-white">
                      {mission.title}
                    </p>
                    <span className="rounded-full bg-violet-500/10 px-2 py-1 text-[10px] font-black text-violet-200">
                      P{mission.priority}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {mission.objective}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.025] p-8 text-center">
          <p className="font-black text-white">No Company Brain analysis yet</p>
          <p className="mt-2 text-sm text-slate-500">
            Run Analyze after generating or opening a project.
          </p>
        </div>
      )}
    </section>
  );
}

function Metric({ title, value }: { title: string; value: number }) {
  return (
    <div className="soft-card rounded-2xl p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
        {title}
      </p>
      <p className="mt-2 text-3xl font-black text-white">{value}</p>
    </div>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-slate-500">
        {title}
      </p>
      <div className="grid gap-2">
        {(items.length ? items : ["none"]).slice(0, 8).map((item) => (
          <div
            key={item}
            className="rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2 text-xs leading-5 text-slate-300"
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  );
            }
        
