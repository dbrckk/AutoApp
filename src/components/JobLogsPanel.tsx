import { useMemo, useState } from "react";
import type { AutoAppState } from "../hooks/useAutoApp";

type LogLevel = "error" | "warn" | "success" | "info" | "debug";
type ParsedLog = {
  id: string;
  raw: string;
  level: LogLevel;
  title: string;
  message: string;
  phase?: string;
  score?: number;
  at: number | null;
};

const FILTERS: { id: "all" | LogLevel; label: string }[] = [
  { id: "all", label: "All" },
  { id: "error", label: "Errors" },
  { id: "warn", label: "Warnings" },
  { id: "success", label: "Success" },
  { id: "info", label: "Info" },
  { id: "debug", label: "Debug" },
];

export function JobLogsPanel({ app }: { app: AutoAppState }) {
  const [filter, setFilter] = useState<"all" | LogLevel>("all");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const logs = useMemo(() => parseLogs(app.jobLogs || []), [app.jobLogs]);

  const filteredLogs = useMemo(() => {
    const q = query.trim().toLowerCase();
    return logs.filter((log) => {
      if (filter !== "all" && log.level !== filter) return false;
      if (!q) return true;
      return `${log.title}\n${log.message}\n${log.raw}\n${log.phase || ""}`.toLowerCase().includes(q);
    });
  }, [logs, filter, query]);

  const stats = useMemo(() => ({
    total: logs.length,
    error: logs.filter((log) => log.level === "error").length,
    warn: logs.filter((log) => log.level === "warn").length,
    success: logs.filter((log) => log.level === "success").length,
    info: logs.filter((log) => log.level === "info").length,
  }), [logs]);

  function copyLogs() {
    const text = filteredLogs.map((log) => log.raw).join("\n");
    navigator.clipboard?.writeText(text).catch(() => undefined);
  }

  return (
    <section className="glass-panel rounded-[2rem] p-5">
      <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-200">Job Logs</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-white">Autonomous execution logs</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Inspect real backend events, timestamps, phases, scores and failures.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => app.handleLoadJobLogs(app.activeJobId)} disabled={app.busy || !app.activeJobId} className="min-h-10 rounded-2xl border border-cyan-400/25 bg-cyan-500/10 px-4 text-xs font-black text-cyan-200 disabled:opacity-50">Refresh logs</button>
          <button onClick={copyLogs} disabled={!filteredLogs.length} className="min-h-10 rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-xs font-black text-white disabled:opacity-50">Copy visible</button>
          <button onClick={app.handleStepJob} disabled={app.busy || !app.activeJobId} className="min-h-10 rounded-2xl border border-violet-400/25 bg-violet-500/10 px-4 text-xs font-black text-violet-200 disabled:opacity-50">Run step</button>
        </div>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Total" value={stats.total} />
        <StatCard label="Errors" value={stats.error} tone="danger" />
        <StatCard label="Warnings" value={stats.warn} tone="warning" />
        <StatCard label="Success" value={stats.success} tone="success" />
        <StatCard label="Info" value={stats.info} />
      </div>

      <div className="mb-5 grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search logs..." className="input-premium min-h-12 rounded-2xl px-4 text-sm" />
        <div className="flex gap-2 overflow-x-auto pb-1">
          {FILTERS.map((item) => (
            <button key={item.id} onClick={() => setFilter(item.id)} className={`shrink-0 rounded-2xl px-4 py-2 text-xs font-black ${filter === item.id ? "bg-white text-black" : "border border-white/10 bg-white/[0.04] text-slate-400"}`}>{item.label}</button>
          ))}
        </div>
      </div>

      {filteredLogs.length ? (
        <div className="grid gap-3">
          {filteredLogs.map((log, index) => {
            const isExpanded = expanded[log.id];
            return (
              <article key={log.id} className="soft-card rounded-3xl p-4 transition hover:border-cyan-400/25">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${toneBadge(log.level)}`}>{log.level}</span>
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">#{index + 1}</span>
                      {log.phase ? <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-200">{log.phase}</span> : null}
                      {typeof log.score === "number" ? <span className="rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-violet-200">{log.score}/100</span> : null}
                    </div>
                    <h3 className="mt-3 text-base font-black text-white">{log.title}</h3>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-400">{isExpanded ? log.message : truncate(log.message, 280)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="rounded-full bg-white/[0.06] px-3 py-1 text-[10px] font-black text-slate-500">{formatTimestamp(log.at)}</span>
                    <button onClick={() => setExpanded((previous) => ({ ...previous, [log.id]: !previous[log.id] }))} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-black uppercase text-slate-300">{isExpanded ? "Less" : "More"}</button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.025] p-8 text-center">
          <p className="text-lg font-black text-white">{logs.length ? "No matching log" : "No logs loaded"}</p>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">{logs.length ? `No log matches "${query || filter}".` : "Open a project or run an autonomous step to load execution logs."}</p>
        </div>
      )}
    </section>
  );
}

function parseLogs(logs: string[]): ParsedLog[] {
  return logs.map((raw, index) => {
    const parsedTimestamp = extractTimestamp(raw);
    const message = stripTimestamp(raw);
    const level = inferLevel(message);
    return {
      id: `log-${index}-${hash(raw)}`,
      raw,
      level,
      title: inferTitle(message, level),
      message,
      phase: extractPhase(message),
      score: extractScore(message),
      at: parsedTimestamp,
    };
  });
}

function extractTimestamp(value: string) {
  const match = String(value || "").match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)\s*[·|-]\s*/);
  if (!match) return null;
  const timestamp = Date.parse(match[1]);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function stripTimestamp(value: string) {
  return String(value || "").replace(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z\s*[·|-]\s*/, "").trim();
}

function inferLevel(value: string): LogLevel {
  const lower = value.toLowerCase();
  if (/error|failed|exception|blocked/.test(lower)) return "error";
  if (/warn|risk|missing|needs/.test(lower)) return "warn";
  if (/success|done|pass|completed|complete/.test(lower)) return "success";
  if (/debug|trace|diagnostic/.test(lower)) return "debug";
  return "info";
}

function inferTitle(value: string, level: LogLevel) {
  const lower = value.toLowerCase();
  if (/github|commit/.test(lower)) return "GitHub event";
  if (/build/.test(lower)) return level === "error" ? "Build issue" : "Build event";
  if (/quality|score/.test(lower)) return "Quality event";
  if (/professional/.test(lower)) return "Professional pipeline event";
  if (/mission|brain/.test(lower)) return "Company Brain event";
  if (/phase/.test(lower)) return "Phase update";
  if (level === "error") return "Error";
  if (level === "warn") return "Warning";
  if (level === "success") return "Success";
  return "Job event";
}

function extractScore(value: string) {
  const match = value.match(/(?:score|quality|professional)\s*:?\s*(\d{1,3})\s*\/\s*100/i);
  if (!match) return undefined;
  const score = Number(match[1]);
  return Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : undefined;
}

function extractPhase(value: string) {
  const match = value.match(/phase\s*:?\s*([a-z0-9_-]+)/i) || value.match(/next\s+([a-z0-9_-]+)/i);
  return match?.[1];
}

function toneBadge(level: LogLevel) {
  if (level === "error") return "border-red-400/20 bg-red-500/10 text-red-200";
  if (level === "warn") return "border-yellow-400/20 bg-yellow-500/10 text-yellow-200";
  if (level === "success") return "border-emerald-400/20 bg-emerald-500/10 text-emerald-200";
  if (level === "debug") return "border-slate-400/20 bg-slate-500/10 text-slate-200";
  return "border-cyan-400/20 bg-cyan-500/10 text-cyan-200";
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: "danger" | "warning" | "success" }) {
  const className = tone === "danger" ? "text-red-300" : tone === "warning" ? "text-yellow-300" : tone === "success" ? "text-emerald-300" : "text-white";
  return <div className="soft-card rounded-2xl p-4"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</p><p className={`mt-2 text-3xl font-black ${className}`}>{value}</p></div>;
}

function truncate(value: string, max: number) { return value.length <= max ? value : `${value.slice(0, max).trim()}...`; }
function formatTimestamp(value: number | null) { if (!value) return "No timestamp"; try { return new Date(value).toLocaleString([], { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }); } catch { return "Invalid time"; } }
function hash(value: string) { let result = 0; for (let index = 0; index < value.length; index += 1) { result = (result << 5) - result + value.charCodeAt(index); result |= 0; } return String(Math.abs(result)); }
