import type { AutoAppState } from "../hooks/useAutoApp";

export function CompanyMissionPanel({ app }: { app: AutoAppState }) {
  const brain =
    app.companyBrainResult?.brain ||
    app.liveWorkspaceResult?.snapshot?.brain ||
    app.projectReport?.professional?.companyBrain;

  const mission = brain?.mission || null;
  const backlog = brain?.backlog || [];
  const memory = brain?.memory || null;
  const kpis = brain?.kpis || null;
  const quality = brain?.quality || null;

  return (
    <section className="glass-panel rounded-[2rem] p-5">
      <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-200">
            Company Mission
          </p>

          <h2 className="mt-2 text-2xl font-black tracking-tight text-white">
            Autonomous product objective
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Current Company Brain mission, product memory, KPI target and
            prioritized execution backlog.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={app.handleAnalyzeCompanyBrain}
            disabled={app.busy}
            className="min-h-10 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-4 text-xs font-black text-emerald-200 disabled:opacity-50"
          >
            Regenerate mission
          </button>

          <button
            onClick={() => app.handleImproveJob(app.activeJobId)}
            disabled={app.busy || !app.activeJobId}
            className="min-h-10 rounded-2xl border border-white/10 bg-white px-4 text-xs font-black text-black disabled:opacity-50"
          >
            Execute improve
          </button>
        </div>
      </div>

      {mission ? (
        <div className="grid gap-5">
          <div className="rounded-[2rem] border border-emerald-400/20 bg-emerald-500/10 p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">
                  Current mission
                </p>

                <h3 className="mt-2 text-2xl font-black text-white">
                  {mission.title || "Improve product quality"}
                </h3>

                <p className="mt-2 max-w-3xl text-sm leading-6 text-emerald-50/75">
                  {mission.objective ||
                    "Raise product quality using the autonomous pipeline."}
                </p>
              </div>

              <div className="grid min-w-[150px] gap-2 rounded-3xl border border-white/10 bg-black/25 p-4 text-center">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                  Priority
                </p>
                <p className="text-4xl font-black text-white">
                  {mission.priority ?? 0}
                </p>
                <p className="text-xs text-slate-500">
                  target {mission.targetScore ?? 85}/100
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Metric label="Overall KPI" value={kpis?.overall ?? 0} />
            <Metric label="Quality" value={quality?.total ?? 0} />
            <Metric label="UX" value={kpis?.ux ?? 0} />
            <Metric label="Autonomy" value={kpis?.autonomy ?? 0} />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <InfoCard
              title="Product memory"
              items={[
                `Vision: ${memory?.vision || "not loaded"}`,
                `Type: ${memory?.productType || "unknown"}`,
                `Target users: ${memory?.targetUsers || "unknown"}`,
              ]}
            />

            <InfoCard
              title="Mission execution"
              items={[
                `Category: ${mission.category || "quality"}`,
                `Status: ${mission.status || "todo"}`,
                `Estimated time: ${mission.estimatedMinutes ?? 20} min`,
              ]}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <ListCard title="Strengths" items={memory?.strengths || []} tone="green" />
            <ListCard title="Weaknesses" items={memory?.weaknesses || []} tone="yellow" />
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/25 p-4">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-black text-white">
                  Prioritized backlog
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Missions ranked by Company Brain priority.
                </p>
              </div>

              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                {backlog.length} items
              </span>
            </div>

            <div className="grid gap-2">
              {(backlog.length ? backlog : [mission]).slice(0, 10).map((item: any) => (
                <article
                  key={item.id || item.title}
                  className="rounded-2xl border border-white/10 bg-white/[0.035] p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-black text-white">
                        {item.title}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        {item.objective}
                      </p>
                    </div>

                    <span className="shrink-0 rounded-full border border-violet-400/20 bg-violet-500/10 px-2 py-1 text-[10px] font-black text-violet-200">
                      P{item.priority ?? 0}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.025] p-8 text-center">
          <p className="text-lg font-black text-white">No mission loaded</p>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
            Run Company Brain analysis to generate a mission, backlog, memory
            and KPI target for this project.
          </p>

          <button
            onClick={app.handleAnalyzeCompanyBrain}
            disabled={app.busy}
            className="mt-5 min-h-11 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-4 text-xs font-black text-emerald-200 disabled:opacity-50"
          >
            Analyze Company Brain
          </button>
        </div>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  const safe = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));

  return (
    <div className="soft-card rounded-2xl p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-3xl font-black text-white">{safe}</p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full ${
            safe >= 85 ? "bg-emerald-400" : safe >= 65 ? "bg-yellow-300" : "bg-red-400"
          }`}
          style={{ width: `${safe}%` }}
        />
      </div>
    </div>
  );
}

function InfoCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/25 p-4">
      <p className="text-sm font-black text-white">{title}</p>
      <div className="mt-3 grid gap-2">
        {items.map((item) => (
          <p key={item} className="text-sm leading-6 text-slate-400">
            {item}
          </p>
        ))}
      </div>
    </div>
  );
}

function ListCard({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "green" | "yellow";
}) {
  const color =
    tone === "green"
      ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
      : "border-yellow-400/20 bg-yellow-500/10 text-yellow-200";

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
                                   
