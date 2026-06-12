import type { AutoAppState } from "../hooks/useAutoApp";

type HealthItem = {
  id: string;
  label: string;
  value: number;
  detail: string;
};

export function ProjectHealthPanel({ app }: { app: AutoAppState }) {
  const items = buildHealthItems(app);
  const overall = Math.round(
    items.reduce((sum, item) => sum + item.value, 0) / Math.max(1, items.length)
  );

  const blockers =
    app.projectReport?.professional?.blockers ||
    app.pipelineResult?.quality?.blockers ||
    [];

  const suggestions =
    app.projectReport?.professional?.suggestions ||
    app.pipelineResult?.quality?.suggestions ||
    [];

  return (
    <section className="glass-panel rounded-[2rem] p-5">
      <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-200">
            Project Health
          </p>

          <h2 className="mt-2 text-2xl font-black tracking-tight text-white">
            Production readiness overview
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Consolidated build, UX, mobile, pipeline, Company Brain, workspace
            and release readiness status.
          </p>
        </div>

        <div className="grid h-28 w-28 shrink-0 place-items-center rounded-full border-[10px] border-emerald-500/80 bg-black/25 shadow-[0_0_70px_rgba(52,211,153,0.25)]">
          <div className="text-center">
            <p className="text-3xl font-black text-white">{overall}</p>
            <p className="text-[10px] text-slate-500">health</p>
          </div>
        </div>
      </div>

      <div className="mb-5 h-3 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full ${getBarClass(overall)}`}
          style={{ width: `${Math.max(0, Math.min(100, overall))}%` }}
        />
      </div>

      <div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <article key={item.id} className="soft-card rounded-2xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                  {item.label}
                </p>

                <p className="mt-2 text-3xl font-black text-white">
                  {item.value}
                  <span className="text-sm text-slate-500">/100</span>
                </p>

                <p className="mt-2 text-xs leading-5 text-slate-500">
                  {item.detail}
                </p>
              </div>

              <span className={`h-3 w-3 shrink-0 rounded-full ${getDotClass(item.value)}`} />
            </div>
          </article>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <IssueColumn
          title="Blockers"
          empty="No blocker detected."
          items={blockers}
          tone="red"
        />

        <IssueColumn
          title="Recommended actions"
          empty="No recommendation yet. Run quality gate."
          items={suggestions}
          tone="violet"
        />
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <button
          onClick={app.handlePipelineQuality}
          disabled={app.busy || !app.files.length}
          className="min-h-11 rounded-2xl border border-violet-400/25 bg-violet-500/10 px-4 text-xs font-black text-violet-200 disabled:opacity-50"
        >
          Run quality
        </button>

        <button
          onClick={app.handlePipelineAutofix}
          disabled={app.busy || !app.files.length}
          className="min-h-11 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-4 text-xs font-black text-emerald-200 disabled:opacity-50"
        >
          Autofix
        </button>

        <button
          onClick={app.handleAnalyzeCompanyBrain}
          disabled={app.busy}
          className="min-h-11 rounded-2xl border border-cyan-400/25 bg-cyan-500/10 px-4 text-xs font-black text-cyan-200 disabled:opacity-50"
        >
          Brain
        </button>

        <button
          onClick={() => app.handleImproveJob(app.activeJobId)}
          disabled={app.busy || !app.activeJobId}
          className="min-h-11 rounded-2xl border border-white/10 bg-white px-4 text-xs font-black text-black disabled:opacity-50"
        >
          Improve
        </button>
      </div>
    </section>
  );
}

function IssueColumn({
  title,
  empty,
  items,
  tone,
}: {
  title: string;
  empty: string;
  items: string[];
  tone: "red" | "violet";
}) {
  const color =
    tone === "red"
      ? "border-red-400/20 bg-red-500/10 text-red-200"
      : "border-violet-400/20 bg-violet-500/10 text-violet-200";

  return (
    <div className="rounded-3xl border border-white/10 bg-black/25 p-4">
      <p className="text-sm font-black text-white">{title}</p>

      <div className="mt-3 grid gap-2">
        {(items.length ? items : [empty]).slice(0, 8).map((item) => (
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

function buildHealthItems(app: AutoAppState): HealthItem[] {
  const professional = app.projectReport?.professional;
  const professionalCategories = professional?.categories || {};
  const companyKpis =
    app.companyBrainResult?.brain?.kpis ||
    app.liveWorkspaceResult?.snapshot?.brain?.kpis ||
    {};
  const workspaceQuality = app.liveWorkspaceResult?.snapshot?.quality || {};
  const buildOk = Boolean(app.projectReport?.build?.ok);
  const score = app.projectReport?.score || {};

  return [
    {
      id: "build",
      label: "Build",
      value: Number(companyKpis.build) || (buildOk ? 100 : 55),
      detail: buildOk ? "Latest report build check passed." : "Build has not been verified.",
    },
    {
      id: "professional",
      label: "Professional pipeline",
      value: Number(professional?.score) || Number(app.pipelineResult?.quality?.total) || 0,
      detail: professional?.focus || app.pipelineResult?.focus || "Run pipeline quality gate.",
    },
    {
      id: "company",
      label: "Company Brain",
      value: Number(companyKpis.overall) || 0,
      detail:
        app.companyBrainResult?.brain?.mission?.title ||
        "Run Company Brain analysis to create a current mission.",
    },
    {
      id: "workspace",
      label: "Live Workspace",
      value: Number(workspaceQuality.total) || 0,
      detail:
        app.liveWorkspaceResult?.snapshot?.refactorPlan?.reason ||
        "Create a workspace snapshot to compute ROI and context.",
    },
    {
      id: "mobile",
      label: "Mobile UX",
      value:
        Number(companyKpis.mobile) ||
        Number(professionalCategories.mobile) ||
        Number(score.mobile) ||
        0,
      detail: "Mobile layout, scroll behavior and responsive usability.",
    },
    {
      id: "resilience",
      label: "Resilience",
      value:
        Number(professionalCategories.resilience) ||
        Number(score.reliability) ||
        0,
      detail: "Loading, empty, error, fallback and persistence coverage.",
    },
    {
      id: "product",
      label: "Product depth",
      value:
        Number(professionalCategories.productDepth) ||
        Number(score.productionReadiness) ||
        0,
      detail: "Real workflows, useful screens and non-placeholder features.",
    },
    {
      id: "autonomy",
      label: "Autonomy",
      value:
        Number(companyKpis.autonomy) ||
        (app.activeJob?.status === "running" ? 90 : app.activeJob ? 72 : 40),
      detail: app.activeJob
        ? `Current job status: ${app.activeJob.status || "unknown"}`
        : "No active autonomous job selected.",
    },
    {
      id: "github",
      label: "GitHub export",
      value: app.githubRepo ? 85 : 40,
      detail: app.githubRepo || "Set owner/repo to enable export.",
    },
  ];
}

function getBarClass(value: number) {
  if (value >= 85) return "bg-emerald-400";
  if (value >= 65) return "bg-yellow-300";
  return "bg-red-400";
}

function getDotClass(value: number) {
  if (value >= 85) return "bg-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.5)]";
  if (value >= 65) return "bg-yellow-300 shadow-[0_0_20px_rgba(253,224,71,0.45)]";
  return "bg-red-400 shadow-[0_0_20px_rgba(248,113,113,0.5)]";
                  }
            
