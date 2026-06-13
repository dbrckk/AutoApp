import type { AutoAppState } from "../hooks/useAutoApp";

type InsightTone = "red" | "yellow" | "green" | "violet" | "cyan";

type Insight = {
  id: string;
  title: string;
  detail: string;
  tone: InsightTone;
  score?: number;
};

export function QualityInsightsPanel({ app }: { app: AutoAppState }) {
  const quality =
    app.pipelineResult?.quality ||
    app.projectReport?.professional ||
    app.liveWorkspaceResult?.snapshot?.quality ||
    null;

  const categories =
    quality?.categories ||
    app.projectReport?.professional?.categories ||
    {};

  const blockers =
    quality?.blockers ||
    app.projectReport?.professional?.blockers ||
    [];

  const warnings =
    quality?.warnings ||
    app.projectReport?.professional?.warnings ||
    [];

  const suggestions =
    quality?.suggestions ||
    app.projectReport?.professional?.suggestions ||
    [];

  const score =
    Number(quality?.total) ||
    Number(quality?.score) ||
    Number(app.projectReport?.professional?.score) ||
    0;

  const insights = buildInsights({
    categories,
    blockers,
    warnings,
    suggestions,
    score,
  });

  return (
    <section className="glass-panel rounded-[2rem] p-5">
      <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-violet-200">
            Quality Insights
          </p>

          <h2 className="mt-2 text-2xl font-black tracking-tight text-white">
            Professional quality diagnosis
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Prioritized interpretation of buildability, structure, UI/UX,
            mobile, resilience and product depth.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={app.handlePipelineQuality}
            disabled={app.busy || !app.files.length}
            className="min-h-10 rounded-2xl border border-violet-400/25 bg-violet-500/10 px-4 text-xs font-black text-violet-200 disabled:opacity-50"
          >
            Run quality gate
          </button>

          <button
            onClick={app.handlePipelineAutofix}
            disabled={app.busy || !app.files.length}
            className="min-h-10 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-4 text-xs font-black text-emerald-200 disabled:opacity-50"
          >
            Autofix
          </button>
        </div>
      </div>

      {quality ? (
        <div className="grid gap-5">
          <div className="rounded-[2rem] border border-white/10 bg-black/25 p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-black text-white">
                  Current quality score
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  {quality.passed
                    ? "Quality gate passed."
                    : "Quality gate still requires improvement."}
                </p>
              </div>

              <div className="text-right">
                <p className="text-5xl font-black text-white">{score}</p>
                <p className="text-xs text-slate-500">/100</p>
              </div>
            </div>

            <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full rounded-full ${
                  score >= 85 ? "bg-emerald-400" : score >= 65 ? "bg-yellow-300" : "bg-red-400"
                }`}
                style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Object.entries(categories).map(([key, value]) => (
              <CategoryCard key={key} label={key} value={Number(value) || 0} />
            ))}
          </div>

          <div className="grid gap-3">
            {insights.map((insight) => (
              <InsightCard key={insight.id} insight={insight} />
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.025] p-8 text-center">
          <p className="text-lg font-black text-white">
            No quality insight loaded
          </p>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
            Run the professional quality gate or open a project report to
            generate actionable insights.
          </p>
        </div>
      )}
    </section>
  );
}

function CategoryCard({ label, value }: { label: string; value: number }) {
  const safe = Math.max(0, Math.min(100, Math.round(value)));

  return (
    <article className="soft-card rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
            {label}
          </p>
          <p className="mt-2 text-2xl font-black text-white">{safe}/100</p>
        </div>

        <span className={`h-3 w-3 rounded-full ${dotClass(safe)}`} />
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full ${barClass(safe)}`}
          style={{ width: `${safe}%` }}
        />
      </div>
    </article>
  );
}

function InsightCard({ insight }: { insight: Insight }) {
  const color =
    insight.tone === "red"
      ? "border-red-400/20 bg-red-500/10 text-red-100"
      : insight.tone === "yellow"
      ? "border-yellow-400/20 bg-yellow-500/10 text-yellow-100"
      : insight.tone === "green"
      ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-100"
      : insight.tone === "cyan"
      ? "border-cyan-400/20 bg-cyan-500/10 text-cyan-100"
      : "border-violet-400/20 bg-violet-500/10 text-violet-100";

  return (
    <article className={`rounded-3xl border p-4 ${color}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-black">{insight.title}</p>
          <p className="mt-1 text-sm leading-6 opacity-80">{insight.detail}</p>
        </div>

        {typeof insight.score === "number" ? (
          <span className="shrink-0 rounded-full bg-black/20 px-3 py-1 text-xs font-black">
            {insight.score}/100
          </span>
        ) : null}
      </div>
    </article>
  );
}

function buildInsights(input: {
  categories: Record<string, any>;
  blockers: string[];
  warnings: string[];
  suggestions: string[];
  score: number;
}): Insight[] {
  const insights: Insight[] = [];

  if (input.blockers.length) {
    insights.push({
      id: "blockers",
      title: "Critical blockers detected",
      detail: input.blockers.slice(0, 4).join(" | "),
      tone: "red",
    });
  }

  const categoryEntries = Object.entries(input.categories)
    .map(([key, value]) => [key, Number(value) || 0] as const)
    .sort((a, b) => a[1] - b[1]);

  const weakest = categoryEntries[0];

  if (weakest) {
    insights.push({
      id: "weakest",
      title: `Weakest category: ${weakest[0]}`,
      detail: getCategoryAdvice(weakest[0]),
      tone: weakest[1] >= 80 ? "green" : weakest[1] >= 60 ? "yellow" : "red",
      score: weakest[1],
    });
  }

  if (input.warnings.length) {
    insights.push({
      id: "warnings",
      title: "Warnings",
      detail: input.warnings.slice(0, 4).join(" | "),
      tone: "yellow",
    });
  }

  if (input.suggestions.length) {
    insights.push({
      id: "suggestions",
      title: "Best next action",
      detail: input.suggestions[0],
      tone: "violet",
    });
  }

  if (input.score >= 85) {
    insights.push({
      id: "release",
      title: "Near release-ready",
      detail:
        "Quality is strong. Focus next on real build validation, deployment, release notes and final UX polish.",
      tone: "green",
      score: input.score,
    });
  }

  return insights.length
    ? insights
    : [
        {
          id: "empty",
          title: "No major issue detected",
          detail: "Run another quality gate after the next autonomous update.",
          tone: "cyan",
        },
      ];
}

function getCategoryAdvice(category: string) {
  if (category === "buildability") return "Fix missing files, imports, dependencies and package configuration first.";
  if (category === "structure") return "Improve folder structure, split large components and isolate reusable logic.";
  if (category === "uiUx") return "Improve visual hierarchy, actions, empty states and page clarity.";
  if (category === "mobile") return "Strengthen responsive layout, spacing, scroll behavior and touch targets.";
  if (category === "resilience") return "Add loading, error, empty and fallback states plus safe persistence.";
  if (category === "productDepth") return "Add complete workflows and remove placeholder-only sections.";
  return "Improve the lowest quality category before expanding features.";
}

function barClass(value: number) {
  if (value >= 85) return "bg-emerald-400";
  if (value >= 65) return "bg-yellow-300";
  return "bg-red-400";
}

function dotClass(value: number) {
  if (value >= 85) return "bg-emerald-400";
  if (value >= 65) return "bg-yellow-300";
  return "bg-red-400";
    }
          
