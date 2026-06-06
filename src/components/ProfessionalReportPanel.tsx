import type { AutoAppState } from "../hooks/useAutoApp";

export function ProfessionalReportPanel({ app }: { app: AutoAppState }) {
  const professional = app.projectReport?.professional;
  const nextActions = app.projectReport?.nextActions || [];
  const summary = app.projectReport?.summary || "";

  if (!professional) {
    return (
      <section className="glass-panel rounded-[2rem] p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-white">Professional Report</h2>
            <p className="mt-1 text-sm text-slate-500">
              Open a project report to see the professional pipeline analysis.
            </p>
          </div>

          <button
            onClick={() => app.refreshProjectReport(app.activeJobId)}
            disabled={app.busy || !app.activeJobId}
            className="min-h-10 rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-xs font-black text-white disabled:opacity-50"
          >
            Load
          </button>
        </div>
      </section>
    );
  }

  const score = Number(professional.score || 0);
  const categories = professional.categories || {};
  const productPlan = professional.productPlan || {};
  const architecturePlan = professional.architecturePlan || {};

  return (
    <section className="glass-panel rounded-[2rem] p-5">
      <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-violet-200">
            Professional Pipeline
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-white">
            {productPlan.productName || "Product Report"}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            {summary || productPlan.corePromise || "Quality, architecture and release analysis."}
          </p>
        </div>

        <div className="grid min-w-[140px] place-items-center rounded-[2rem] border border-white/10 bg-black/25 p-4">
          <div className="text-center">
            <p className="text-4xl font-black text-white">{score}</p>
            <p className="text-xs text-slate-500">professional score</p>
            <span
              className={`mt-3 inline-block rounded-full px-3 py-1 text-[11px] font-black ${
                professional.passed
                  ? "bg-emerald-500/10 text-emerald-300"
                  : "bg-yellow-500/10 text-yellow-300"
              }`}
            >
              {professional.passed ? "passed" : "needs work"}
            </span>
          </div>
        </div>
      </div>

      <div className="mb-5 h-3 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full ${
            score >= 85 ? "bg-emerald-400" : score >= 65 ? "bg-yellow-300" : "bg-red-400"
          }`}
          style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
        />
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Object.entries(categories).map(([key, value]) => (
          <div key={key} className="soft-card rounded-2xl p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
              {key}
            </p>
            <p className="mt-2 text-2xl font-black text-white">
              {String(value)}
              <span className="text-sm text-slate-500">/100</span>
            </p>
          </div>
        ))}
      </div>

      <div className="mb-5 grid gap-4 xl:grid-cols-2">
        <InfoBlock
          title="Product Plan"
          items={[
            "Category: " + (productPlan.category || "unknown"),
            "Audience: " + (productPlan.audience || "unknown"),
            "Promise: " + (productPlan.corePromise || "not loaded"),
            "Focus: " + (professional.focus || "quality"),
          ]}
        />

        <InfoBlock
          title="Architecture"
          items={[
            "Stack: " + ((architecturePlan.stack || []).join(", ") || "not loaded"),
            "State: " + (architecturePlan.stateStrategy || "not loaded"),
            "Routing: " + (architecturePlan.routingStrategy || "not loaded"),
            "Persistence: " + (architecturePlan.persistenceStrategy || "not loaded"),
          ]}
        />
      </div>

      <div className="mb-5 grid gap-4 xl:grid-cols-3">
        <IssueList title="Blockers" items={professional.blockers || []} tone="red" />
        <IssueList title="Warnings" items={professional.warnings || []} tone="yellow" />
        <IssueList title="Suggestions" items={professional.suggestions || []} tone="violet" />
      </div>

      <div className="rounded-3xl border border-white/10 bg-black/25 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black text-white">Next Actions</h3>
            <p className="mt-1 text-xs text-slate-500">
              Prioritized actions generated from the professional quality gate.
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

        <div className="grid gap-2">
          {(nextActions.length ? nextActions : ["Run another pipeline quality check."])
            .slice(0, 10)
            .map((item: string, index: number) => (
              <div
                key={`${item}-${index}`}
                className="rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2 text-sm leading-6 text-slate-300"
              >
                {index + 1}. {item}
              </div>
            ))}
        </div>
      </div>
    </section>
  );
}

function InfoBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/25 p-4">
      <h3 className="text-sm font-black text-white">{title}</h3>
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
      ? "border-red-400/20 bg-red-500/10 text-red-200"
      : tone === "yellow"
      ? "border-yellow-400/20 bg-yellow-500/10 text-yellow-200"
      : "border-violet-400/20 bg-violet-500/10 text-violet-200";

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
  
