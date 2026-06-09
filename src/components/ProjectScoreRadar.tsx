import type { AutoAppState } from "../hooks/useAutoApp";

type RadarMetric = {
  id: string;
  label: string;
  value: number;
};

export function ProjectScoreRadar({ app }: { app: AutoAppState }) {
  const metrics = buildMetrics(app);
  const overall = Math.round(
    metrics.reduce((sum, metric) => sum + metric.value, 0) /
      Math.max(1, metrics.length)
  );

  const professionalScore =
    Number(app.projectReport?.professional?.score) ||
    Number(app.pipelineResult?.quality?.total) ||
    0;

  const companyScore =
    Number(app.companyBrainResult?.brain?.kpis?.overall) ||
    Number(app.liveWorkspaceResult?.snapshot?.brain?.kpis?.overall) ||
    0;

  return (
    <section className="glass-panel rounded-[2rem] p-5">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-violet-200">
            Project Score
          </p>

          <h2 className="mt-2 text-xl font-black text-white">
            Quality radar
          </h2>

          <p className="mt-1 text-sm leading-6 text-slate-500">
            Combined score from project report, professional pipeline, Company
            Brain and live workspace.
          </p>
        </div>

        <div className="grid h-24 w-24 shrink-0 place-items-center rounded-full border-[10px] border-violet-500/80 bg-black/25 shadow-[0_0_60px_rgba(124,92,255,0.28)]">
          <div className="text-center">
            <p className="text-2xl font-black text-white">{overall}</p>
            <p className="text-[10px] text-slate-500">/100</p>
          </div>
        </div>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <ScoreTile label="Professional" value={professionalScore} />
        <ScoreTile label="Company Brain" value={companyScore} />
      </div>

      <div className="grid gap-3">
        {metrics.map((metric) => (
          <MetricBar key={metric.id} metric={metric} />
        ))}
      </div>

      <div className="mt-5 rounded-3xl border border-white/10 bg-black/25 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-black text-white">Recommended focus</p>
            <p className="mt-1 text-sm leading-6 text-slate-400">
              {getFocusLabel(metrics)}
            </p>
          </div>

          <button
            onClick={() => app.handleImproveJob(app.activeJobId)}
            disabled={app.busy || !app.activeJobId}
            className="min-h-10 rounded-2xl border border-violet-400/25 bg-violet-500/10 px-4 text-xs font-black text-violet-200 disabled:opacity-50"
          >
            Improve
          </button>
        </div>
      </div>
    </section>
  );
}

function ScoreTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="soft-card rounded-2xl p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-3xl font-black text-white">
        {Math.max(0, Math.min(100, Math.round(value)))}
      </p>
    </div>
  );
}

function MetricBar({ metric }: { metric: RadarMetric }) {
  const value = Math.max(0, Math.min(100, Math.round(metric.value)));

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-white">{metric.label}</p>
        <p className="text-sm font-black text-white">{value}/100</p>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full ${getBarClass(value)}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function buildMetrics(app: AutoAppState): RadarMetric[] {
  const professional = app.projectReport?.professional;
  const professionalCategories = professional?.categories || {};
  const companyKpis =
    app.companyBrainResult?.brain?.kpis ||
    app.liveWorkspaceResult?.snapshot?.brain?.kpis ||
    {};
  const score = app.projectReport?.score || {};
  const pipelineQuality = app.pipelineResult?.quality || {};
  const workspaceQuality = app.liveWorkspaceResult?.snapshot?.quality || {};

  return [
    {
      id: "build",
      label: "Build",
      value:
        Number(companyKpis.build) ||
        (app.projectReport?.build?.ok ? 100 : 50),
    },
    {
      id: "ux",
      label: "UX",
      value:
        Number(companyKpis.ux) ||
        Number(professionalCategories.uiUx) ||
        Number(score.ux) ||
        0,
    },
    {
      id: "mobile",
      label: "Mobile",
      value:
        Number(companyKpis.mobile) ||
        Number(professionalCategories.mobile) ||
        Number(score.mobile) ||
        0,
    },
    {
      id: "architecture",
      label: "Architecture",
      value:
        Number(companyKpis.architecture) ||
        Number(professionalCategories.structure) ||
        Number(score.architecture) ||
        0,
    },
    {
      id: "resilience",
      label: "Resilience",
      value:
        Number(professionalCategories.resilience) ||
        Number(score.reliability) ||
        0,
    },
    {
      id: "product",
      label: "Product depth",
      value:
        Number(professionalCategories.productDepth) ||
        Number(score.productionReadiness) ||
        0,
    },
    {
      id: "pipeline",
      label: "Pipeline",
      value:
        Number(pipelineQuality.total) ||
        Number(workspaceQuality.total) ||
        Number(professional?.score) ||
        0,
    },
    {
      id: "autonomy",
      label: "Autonomy",
      value:
        Number(companyKpis.autonomy) ||
        (app.activeJob?.status === "running" ? 90 : app.activeJob ? 72 : 40),
    },
  ];
}

function getFocusLabel(metrics: RadarMetric[]) {
  const sorted = [...metrics].sort((a, b) => a.value - b.value);
  const weakest = sorted[0];

  if (!weakest) return "No score available yet.";

  if (weakest.value >= 90) {
    return "Project quality is strong. Focus on final polish, release notes and real deployment validation.";
  }

  if (weakest.id === "build") return "Fix build stability before adding new features.";
  if (weakest.id === "ux") return "Improve onboarding, empty states, action hierarchy and page clarity.";
  if (weakest.id === "mobile") return "Improve mobile layout, spacing, scroll behavior and touch actions.";
  if (weakest.id === "architecture") return "Split large components, clarify folders and reduce coupling.";
  if (weakest.id === "resilience") return "Add loading, empty, error and fallback states.";
  if (weakest.id === "product") return "Deepen real workflows and remove placeholder-only sections.";
  if (weakest.id === "pipeline") return "Run professional quality gate and autofix.";

  return "Continue autonomous improvement on the weakest quality category.";
}

function getBarClass(value: number) {
  if (value >= 85) return "bg-emerald-400";
  if (value >= 65) return "bg-yellow-300";
  return "bg-red-400";
      }
      
