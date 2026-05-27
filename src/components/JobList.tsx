import type { AutoAppState } from "../hooks/useAutoApp";
import { Panel } from "./Panel";

export function JobList({ app }: { app: AutoAppState }) {
  return (
    <Panel title="Autonomous Jobs">
      <div className="grid gap-3">
        {app.jobs.length ? (
          app.jobs.map((job) => (
            <button
              key={job.id}
              onClick={() => {
                app.setActiveJobId(job.id);
                app.refreshJobFiles(job.id).catch(() => undefined);
              }}
              className={`rounded-2xl border p-4 text-left transition ${
                app.activeJobId === job.id
                  ? "border-white/30 bg-white/10"
                  : "border-white/10 bg-black/40 hover:bg-white/5"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-black text-white">{job.target}</span>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-zinc-300">
                  {job.status}
                </span>
              </div>

              <p className="mt-2 line-clamp-2 text-xs leading-5 text-zinc-400">
                {job.prompt}
              </p>

              <p className="mt-2 text-xs text-zinc-500">
                phase {job.phase} · score {job.score}/100 · attempts{" "}
                {job.attempts}/{job.max_attempts}
              </p>
            </button>
          ))
        ) : (
          <p className="text-sm text-zinc-500">No jobs loaded.</p>
        )}
      </div>
    </Panel>
  );
            }
