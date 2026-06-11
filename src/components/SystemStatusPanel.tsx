import type { AutoAppState } from "../hooks/useAutoApp";

type StatusTone = "green" | "yellow" | "red" | "violet" | "blue";

type StatusItem = {
  label: string;
  value: string;
  detail: string;
  tone: StatusTone;
};

export function SystemStatusPanel({ app }: { app: AutoAppState }) {
  const items = buildStatusItems(app);

  return (
    <section className="glass-panel rounded-[2rem] p-5">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-200">
            System Status
          </p>

          <h2 className="mt-2 text-xl font-black text-white">
            Runtime health
          </h2>

          <p className="mt-1 text-sm leading-6 text-slate-500">
            API, worker, project, pipeline, Company Brain and Live Workspace
            status from the current session.
          </p>
        </div>

        <button
          onClick={app.handleLiveDiagnostics}
          disabled={app.busy}
          className="min-h-10 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-4 text-xs font-black text-emerald-200 disabled:opacity-50"
        >
          Run diagnostics
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <article key={item.label} className="soft-card rounded-2xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                  {item.label}
                </p>

                <p className="mt-2 text-lg font-black text-white">
                  {item.value}
                </p>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {item.detail}
                </p>
              </div>

              <span
                className={`h-3 w-3 shrink-0 rounded-full ${toneDot(
                  item.tone
                )}`}
              />
            </div>
          </article>
        ))}
      </div>

      {app.result ? (
        <details className="mt-5 rounded-3xl border border-white/10 bg-black/25 p-4">
          <summary className="cursor-pointer text-sm font-black text-white">
            Last action result
          </summary>

          <pre className="mt-4 max-h-[360px] overflow-auto whitespace-pre-wrap rounded-2xl bg-black/35 p-4 text-xs leading-5 text-slate-300">
            {safeJson(app.result)}
          </pre>
        </details>
      ) : null}
    </section>
  );
}

function buildStatusItems(app: AutoAppState): StatusItem[] {
  const diagnosticsOk = Boolean(app.diagnostics?.ok);
  const hasActiveJob = Boolean(app.activeJobId);
  const jobRunning = app.activeJob?.status === "running";
  const buildOk = Boolean(app.projectReport?.build?.ok);
  const pipelineScore =
    Number(app.pipelineResult?.quality?.total) ||
    Number(app.projectReport?.professional?.score) ||
    0;
  const brainScore =
    Number(app.companyBrainResult?.brain?.kpis?.overall) ||
    Number(app.liveWorkspaceResult?.snapshot?.brain?.kpis?.overall) ||
    0;
  const workspaceScore =
    Number(app.liveWorkspaceResult?.snapshot?.quality?.total) || 0;

  return [
    {
      label: "API",
      value: diagnosticsOk ? "Operational" : "Unknown",
      detail: diagnosticsOk
        ? "Diagnostics endpoint responded successfully."
        : "Run diagnostics to verify API health.",
      tone: diagnosticsOk ? "green" : "yellow",
    },
    {
      label: "Worker",
      value: app.busy ? "Working" : "Ready",
      detail: app.busy
        ? "A foreground operation is running."
        : "No foreground operation is currently active.",
      tone: app.busy ? "blue" : "green",
    },
    {
      label: "Active job",
      value: hasActiveJob ? app.activeJob?.status || "Selected" : "None",
      detail: hasActiveJob
        ? `Phase: ${app.activeJob?.phase || "unknown"}`
        : "Open or create an autonomous project.",
      tone: jobRunning ? "green" : hasActiveJob ? "violet" : "yellow",
    },
    {
      label: "Build",
      value: buildOk ? "Pass" : "Not verified",
      detail: buildOk
        ? "Latest report indicates build is OK."
        : "Run build check or open a report.",
      tone: buildOk ? "green" : "yellow",
    },
    {
      label: "Professional pipeline",
      value: pipelineScore ? `${pipelineScore}/100` : "Idle",
      detail: pipelineScore
        ? "Quality gate result is available."
        : "Run Pipeline Quality or load project report.",
      tone: pipelineScore >= 80 ? "green" : pipelineScore ? "yellow" : "violet",
    },
    {
      label: "Company Brain",
      value: brainScore ? `${brainScore}/100` : "Idle",
      detail: brainScore
        ? "Company Brain KPI snapshot is available."
        : "Run Company Brain analysis.",
      tone: brainScore >= 80 ? "green" : brainScore ? "yellow" : "violet",
    },
    {
      label: "Live Workspace",
      value: workspaceScore ? `${workspaceScore}/100` : "Idle",
      detail: workspaceScore
        ? "Workspace context and refactor plan are ready."
        : "Create a Live Workspace snapshot.",
      tone:
        workspaceScore >= 80 ? "green" : workspaceScore ? "yellow" : "violet",
    },
    {
      label: "Files",
      value: String(app.projectStats.files),
      detail: `${app.projectStats.lines.toLocaleString()} lines loaded.`,
      tone: app.projectStats.files ? "green" : "yellow",
    },
    {
      label: "GitHub",
      value: app.githubRepo ? "Configured" : "Not set",
      detail: app.githubRepo || "Set owner/repo to enable export.",
      tone: app.githubRepo ? "green" : "yellow",
    },
  ];
}

function toneDot(tone: StatusTone) {
  if (tone === "green") {
    return "bg-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.55)]";
  }

  if (tone === "red") {
    return "bg-red-400 shadow-[0_0_20px_rgba(248,113,113,0.55)]";
  }

  if (tone === "yellow") {
    return "bg-yellow-300 shadow-[0_0_20px_rgba(253,224,71,0.45)]";
  }

  if (tone === "blue") {
    return "bg-cyan-300 shadow-[0_0_20px_rgba(103,232,249,0.45)]";
  }

  return "bg-violet-400 shadow-[0_0_20px_rgba(167,139,250,0.45)]";
}

function safeJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
                  }
        
