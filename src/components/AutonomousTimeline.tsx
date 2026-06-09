import { useMemo, useState } from "react";

import type { AutoAppState } from "../hooks/useAutoApp";

type TimelineType =
  | "success"
  | "error"
  | "info"
  | "warning"
  | "job"
  | "github"
  | "build"
  | "quality"
  | "brain"
  | "workspace";

type TimelineItem = {
  id: string;
  type: TimelineType;
  title: string;
  message: string;
  at: number;
  source: string;
  scoreDelta?: number;
  phase?: string;
  status?: string;
};

const FILTERS: {
  id: "all" | TimelineType;
  label: string;
}[] = [
  { id: "all", label: "All" },
  { id: "job", label: "Jobs" },
  { id: "build", label: "Build" },
  { id: "quality", label: "Quality" },
  { id: "brain", label: "Brain" },
  { id: "workspace", label: "Workspace" },
  { id: "github", label: "GitHub" },
  { id: "error", label: "Errors" },
];

export function AutonomousTimeline({ app }: { app: AutoAppState }) {
  const [filter, setFilter] = useState<"all" | TimelineType>("all");
  const [query, setQuery] = useState("");

  const items = useMemo(() => {
    return buildTimelineItems(app);
  }, [
    app.activityEvents,
    app.jobLogs,
    app.jobs,
    app.activeJob,
    app.projectReport,
    app.pipelineResult,
    app.companyBrainResult,
    app.liveWorkspaceResult,
    app.githubHistory,
    app.status,
  ]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();

    return items.filter((item) => {
      if (filter !== "all" && item.type !== filter) return false;

      if (!q) return true;

      return `${item.title}\n${item.message}\n${item.source}\n${item.phase || ""}\n${
        item.status || ""
      }`
        .toLowerCase()
        .includes(q);
    });
  }, [items, filter, query]);

  const stats = useMemo(() => {
    const errors = items.filter((item) => item.type === "error").length;
    const successes = items.filter((item) => item.type === "success").length;
    const quality = items.filter((item) => item.type === "quality").length;
    const jobs = items.filter((item) => item.type === "job").length;

    return {
      total: items.length,
      errors,
      successes,
      quality,
      jobs,
    };
  }, [items]);

  return (
    <section className="glass-panel rounded-[2rem] p-5">
      <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-violet-200">
            Autonomous Timeline
          </p>

          <h2 className="mt-2 text-2xl font-black tracking-tight text-white">
            Activity, quality and improvement history
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Follow autonomous jobs, build checks, quality gates, Company Brain
            decisions, workspace snapshots and GitHub activity from one timeline.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => app.handleLoadJobLogs(app.activeJobId)}
            disabled={app.busy || !app.activeJobId}
            className="min-h-10 rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-xs font-black text-white transition hover:bg-white/[0.08] disabled:opacity-50"
          >
            Refresh logs
          </button>

          <button
            onClick={app.handlePipelineQuality}
            disabled={app.busy || !app.files.length}
            className="min-h-10 rounded-2xl border border-violet-400/25 bg-violet-500/10 px-4 text-xs font-black text-violet-200 transition hover:bg-violet-500/20 disabled:opacity-50"
          >
            Quality
          </button>

          <button
            onClick={app.handleAnalyzeCompanyBrain}
            disabled={app.busy}
            className="min-h-10 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-4 text-xs font-black text-emerald-200 transition hover:bg-emerald-500/20 disabled:opacity-50"
          >
            Brain
          </button>

          <button
            onClick={app.handleLiveWorkspaceSnapshot}
            disabled={app.busy || !app.files.length}
            className="min-h-10 rounded-2xl border border-cyan-400/25 bg-cyan-500/10 px-4 text-xs font-black text-cyan-200 transition hover:bg-cyan-500/20 disabled:opacity-50"
          >
            Snapshot
          </button>

          <button
            onClick={app.clearActivityEvents}
            disabled={!app.activityEvents?.length}
            className="min-h-10 rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-xs font-black text-white transition hover:bg-white/[0.08] disabled:opacity-50"
          >
            Clear local
          </button>
        </div>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <TimelineStat label="Total events" value={stats.total} />
        <TimelineStat label="Jobs" value={stats.jobs} />
        <TimelineStat label="Quality" value={stats.quality} />
        <TimelineStat label="Success" value={stats.successes} />
        <TimelineStat label="Errors" value={stats.errors} danger={stats.errors > 0} />
      </div>

      <div className="mb-5 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search timeline..."
          className="input-premium min-h-12 rounded-2xl px-4 text-sm"
        />

        <div className="flex gap-2 overflow-x-auto pb-1">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              onClick={() => setFilter(item.id)}
              className={`shrink-0 rounded-2xl px-4 py-2 text-xs font-black transition ${
                filter === item.id
                  ? "bg-white text-black"
                  : "border border-white/10 bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:text-white"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {filteredItems.length ? (
        <div className="relative">
          <div className="absolute bottom-0 left-[18px] top-0 hidden w-px bg-white/10 sm:block" />

          <div className="grid gap-3">
            {filteredItems.map((item, index) => (
              <TimelineCard key={item.id} item={item} index={index} />
            ))}
          </div>
        </div>
      ) : (
        <EmptyTimeline
          hasItems={items.length > 0}
          query={query}
          filter={filter}
          app={app}
        />
      )}
    </section>
  );
}

function TimelineStat({
  label,
  value,
  danger,
}: {
  label: string;
  value: number;
  danger?: boolean;
}) {
  return (
    <div className="soft-card rounded-2xl p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>

      <p className={`mt-2 text-3xl font-black ${danger ? "text-red-300" : "text-white"}`}>
        {value}
      </p>
    </div>
  );
}

function TimelineCard({ item, index }: { item: TimelineItem; index: number }) {
  const tone = getTone(item.type);

  return (
    <article className="relative sm:pl-12">
      <div
        className={`absolute left-0 top-4 z-10 hidden h-9 w-9 place-items-center rounded-full border text-[10px] font-black sm:grid ${tone.dot}`}
      >
        {getTypeLabel(item.type)}
      </div>

      <div className="soft-card rounded-3xl p-4 transition hover:border-violet-400/30 hover:bg-white/[0.06]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${tone.badge}`}>
                {item.type}
              </span>

              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                {item.source}
              </span>

              {item.phase ? (
                <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-cyan-200">
                  {item.phase}
                </span>
              ) : null}

              {item.scoreDelta ? (
                <span
                  className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${
                    item.scoreDelta >= 0
                      ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
                      : "border-red-400/20 bg-red-500/10 text-red-200"
                  }`}
                >
                  {item.scoreDelta >= 0 ? "+" : ""}
                  {item.scoreDelta}
                </span>
              ) : null}
            </div>

            <h3 className="mt-3 text-base font-black text-white">
              {item.title}
            </h3>

            {item.message ? (
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-400">
                {item.message}
              </p>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-2 text-right">
            <span className="rounded-full bg-white/[0.06] px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
              #{index + 1}
            </span>

            <span className="rounded-full bg-white/[0.06] px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
              {formatTime(item.at)}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

function EmptyTimeline({
  hasItems,
  query,
  filter,
  app,
}: {
  hasItems: boolean;
  query: string;
  filter: string;
  app: AutoAppState;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.025] p-8 text-center">
      <p className="text-lg font-black text-white">
        {hasItems ? "No matching event" : "No timeline event yet"}
      </p>

      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
        {hasItems
          ? `No event matches "${query || filter}". Change filter or search.`
          : "Start or open an autonomous project to load generation, repair, quality and workspace history."}
      </p>

      {!hasItems ? (
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button
            onClick={app.handleStartAutonomous}
            disabled={app.busy}
            className="min-h-11 rounded-2xl bg-white px-4 text-xs font-black text-black disabled:opacity-50"
          >
            Start project
          </button>

          <button
            onClick={() => app.handleLoadJobLogs(app.activeJobId)}
            disabled={app.busy || !app.activeJobId}
            className="min-h-11 rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-xs font-black text-white disabled:opacity-50"
          >
            Load logs
          </button>
        </div>
      ) : null}
    </div>
  );
}

function buildTimelineItems(app: AutoAppState): TimelineItem[] {
  const items: TimelineItem[] = [];

  for (const event of app.activityEvents || []) {
    items.push({
      id: `activity-${event.id}`,
      type: normalizeActivityType(event.type),
      title: event.title,
      message: event.message || "",
      at: event.at || Date.now(),
      source: "local",
    });
  }

  for (const [index, log] of (app.jobLogs || []).entries()) {
    items.push({
      id: `job-log-${index}-${hash(log)}`,
      type: inferLogType(log),
      title: inferLogTitle(log),
      message: log,
      at: Date.now() - index * 60_000,
      source: "job logs",
      phase: app.activeJob?.phase,
      status: app.activeJob?.status,
    });
  }

  for (const [index, job] of (app.jobs || []).entries()) {
    items.push({
      id: `job-${job.id}`,
      type: "job",
      title: job.target || "Autonomous job",
      message: [
        `Status: ${job.status || "unknown"}`,
        `Phase: ${job.phase || "unknown"}`,
        `Score: ${job.score ?? 0}/100`,
      ].join("\n"),
      at: parseTime(job.updated_at || job.created_at) || Date.now() - index * 90_000,
      source: "jobs",
      phase: job.phase,
      status: job.status,
    });
  }

  if (app.projectReport?.professional) {
    const professional = app.projectReport.professional;

    items.push({
      id: "project-report-professional",
      type: "quality",
      title: "Professional report loaded",
      message: [
        `Professional score: ${professional.score ?? 0}/100`,
        `Focus: ${professional.focus || "quality"}`,
        `Passed: ${professional.passed ? "yes" : "no"}`,
      ].join("\n"),
      at: Date.now() - 5_000,
      source: "report",
    });
  }

  if (app.pipelineResult?.quality) {
    const quality = app.pipelineResult.quality;

    items.push({
      id: "pipeline-quality",
      type: "quality",
      title: "Pipeline quality gate",
      message: [
        `Score: ${quality.total ?? 0}/100`,
        `Passed: ${quality.passed ? "yes" : "no"}`,
        ...(quality.suggestions || []).slice(0, 3).map((item: string) => `Suggestion: ${item}`),
      ].join("\n"),
      at: Date.now() - 10_000,
      source: "pipeline",
    });
  }

  if (app.companyBrainResult?.brain) {
    const brain = app.companyBrainResult.brain;

    items.push({
      id: "company-brain",
      type: "brain",
      title: brain.mission?.title || "Company Brain analyzed",
      message: [
        brain.mission?.objective || "Mission generated.",
        `Overall KPI: ${brain.kpis?.overall ?? 0}/100`,
        `Quality: ${brain.quality?.total ?? 0}/100`,
      ].join("\n"),
      at: Date.now() - 15_000,
      source: "company brain",
    });
  }

  if (app.liveWorkspaceResult?.snapshot) {
    const snapshot = app.liveWorkspaceResult.snapshot;

    items.push({
      id: "live-workspace",
      type: "workspace",
      title: "Live workspace snapshot",
      message: [
        `Selected: ${snapshot.selectedFilePath || "none"}`,
        `Refactor action: ${snapshot.refactorPlan?.action || "none"}`,
        `ROI: ${snapshot.refactorPlan?.roi ?? 0}/100`,
      ].join("\n"),
      at: Date.now() - 20_000,
      source: "workspace",
    });
  }

  for (const [index, commit] of (app.githubHistory || []).entries()) {
    const sha = commit.sha || commit.id || String(index);
    const message = commit.message || commit.commit?.message || "GitHub commit";

    items.push({
      id: `github-${sha}`,
      type: "github",
      title: message.split("\n")[0],
      message: [
        `Commit: ${String(sha).slice(0, 7)}`,
        `Author: ${commit.author || commit.commit?.author?.name || "unknown"}`,
      ].join("\n"),
      at:
        parseTime(commit.date || commit.commit?.author?.date || commit.commit?.committer?.date) ||
        Date.now() - index * 120_000,
      source: "github",
    });
  }

  if (app.status && app.status !== "Ready.") {
    items.push({
      id: `status-${hash(app.status)}`,
      type: app.status.toLowerCase().includes("fail") ? "error" : "info",
      title: "Current status",
      message: app.status,
      at: Date.now(),
      source: "status",
    });
  }

  return dedupeItems(items).sort((a, b) => b.at - a.at).slice(0, 120);
}

function dedupeItems(items: TimelineItem[]) {
  const seen = new Set<string>();
  const output: TimelineItem[] = [];

  for (const item of items) {
    const key = `${item.type}-${item.title}-${item.message}`;

    if (seen.has(key)) continue;

    seen.add(key);
    output.push(item);
  }

  return output;
}

function normalizeActivityType(type: string): TimelineType {
  if (type === "success") return "success";
  if (type === "error") return "error";
  if (type === "info") return "info";
  if (type === "warning") return "warning";
  return "info";
}

function inferLogType(log: string): TimelineType {
  const lower = log.toLowerCase();

  if (lower.includes("error") || lower.includes("failed") || lower.includes("fail")) {
    return "error";
  }

  if (lower.includes("build")) return "build";
  if (lower.includes("quality") || lower.includes("score")) return "quality";
  if (lower.includes("github") || lower.includes("commit")) return "github";
  if (lower.includes("brain") || lower.includes("mission")) return "brain";
  if (lower.includes("workspace") || lower.includes("snapshot")) return "workspace";
  if (lower.includes("done") || lower.includes("success")) return "success";

  return "job";
}

function inferLogTitle(log: string) {
  const lower = log.toLowerCase();

  if (lower.includes("error") || lower.includes("failed")) return "Error detected";
  if (lower.includes("build")) return "Build event";
  if (lower.includes("quality") || lower.includes("score")) return "Quality event";
  if (lower.includes("github") || lower.includes("commit")) return "GitHub event";
  if (lower.includes("mission")) return "Mission event";
  if (lower.includes("phase")) return "Phase update";

  return "Autonomous event";
}

function getTone(type: TimelineType) {
  if (type === "error") {
    return {
      dot: "border-red-400/30 bg-red-500/20 text-red-200",
      badge: "border-red-400/20 bg-red-500/10 text-red-200",
    };
  }

  if (type === "success") {
    return {
      dot: "border-emerald-400/30 bg-emerald-500/20 text-emerald-200",
      badge: "border-emerald-400/20 bg-emerald-500/10 text-emerald-200",
    };
  }

  if (type === "build") {
    return {
      dot: "border-yellow-400/30 bg-yellow-500/20 text-yellow-200",
      badge: "border-yellow-400/20 bg-yellow-500/10 text-yellow-200",
    };
  }

  if (type === "quality") {
    return {
      dot: "border-violet-400/30 bg-violet-500/20 text-violet-200",
      badge: "border-violet-400/20 bg-violet-500/10 text-violet-200",
    };
  }

  if (type === "brain") {
    return {
      dot: "border-emerald-400/30 bg-emerald-500/20 text-emerald-200",
      badge: "border-emerald-400/20 bg-emerald-500/10 text-emerald-200",
    };
  }

  if (type === "workspace") {
    return {
      dot: "border-cyan-400/30 bg-cyan-500/20 text-cyan-200",
      badge: "border-cyan-400/20 bg-cyan-500/10 text-cyan-200",
    };
  }

  if (type === "github") {
    return {
      dot: "border-slate-400/30 bg-slate-500/20 text-slate-200",
      badge: "border-slate-400/20 bg-slate-500/10 text-slate-200",
    };
  }

  return {
    dot: "border-white/20 bg-white/10 text-white",
    badge: "border-white/10 bg-white/[0.06] text-slate-300",
  };
}

function getTypeLabel(type: TimelineType) {
  const labels: Record<TimelineType, string> = {
    success: "OK",
    error: "ER",
    info: "IN",
    warning: "WA",
    job: "JB",
    github: "GH",
    build: "BD",
    quality: "Q",
    brain: "BR",
    workspace: "WS",
  };

  return labels[type] || "IN";
}

function parseTime(value: unknown) {
  if (!value) return 0;

  if (typeof value === "number") return value;

  const parsed = Date.parse(String(value));

  return Number.isFinite(parsed) ? parsed : 0;
}

function formatTime(value: number) {
  try {
    return new Date(value).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "--:--";
  }
}

function hash(value: string) {
  let result = 0;

  for (let index = 0; index < value.length; index += 1) {
    result = (result << 5) - result + value.charCodeAt(index);
    result |= 0;
  }

  return String(Math.abs(result));
}
