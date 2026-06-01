import type { AutoAppState } from "../hooks/useAutoApp";

type SidebarSection = {
  label: string;
  value: string;
};

export function SidebarNavigation({
  app,
  activeView,
  onViewChange,
}: {
  app: AutoAppState;
  activeView: string;
  onViewChange: (view: string) => void;
}) {
  const sections: SidebarSection[] = [
    { label: "Overview", value: "overview" },
    { label: "Files", value: "files" },
    { label: "Timeline", value: "timeline" },
    { label: "Release", value: "release" },
    { label: "GitHub", value: "github" },
    { label: "Logs", value: "logs" },
  ];

  const running = app.jobs.filter((job) => job.status === "running").length;

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="rounded-[1.7rem] border border-white/10 bg-white/[0.04] p-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white text-sm font-black text-black">
            AI
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-white">AutoApp</p>
            <p className="truncate text-xs text-zinc-500">Product OS</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Metric label="Jobs" value={String(app.jobs.length)} />
          <Metric label="Run" value={String(running)} />
          <Metric label="Files" value={String(app.files.length)} />
        </div>
      </div>

      <nav className="rounded-[1.7rem] border border-white/10 bg-white/[0.03] p-2">
        {sections.map((section) => {
          const active = activeView === section.value;

          return (
            <button
              key={section.value}
              onClick={() => onViewChange(section.value)}
              className={`mb-1 flex min-h-11 w-full items-center justify-between rounded-2xl px-3 text-left text-sm font-bold transition last:mb-0 active:scale-[0.99] ${
                active
                  ? "bg-white text-black"
                  : "text-zinc-400 hover:bg-white/10 hover:text-white"
              }`}
            >
              <span>{section.label}</span>
              {active ? <span className="text-xs">●</span> : null}
            </button>
          );
        })}
      </nav>

      <div className="rounded-[1.7rem] border border-white/10 bg-white/[0.03] p-3">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-zinc-500">
            Projects
          </p>
          <button
            onClick={() => app.refreshJobs()}
            disabled={app.busy}
            className="rounded-xl border border-white/10 px-2 py-1 text-[10px] font-black text-zinc-300 disabled:opacity-40"
          >
            Sync
          </button>
        </div>

        <div className="grid max-h-[310px] gap-2 overflow-auto pr-1">
          {app.jobs.length ? (
            app.jobs.slice(0, 8).map((job) => {
              const active = app.activeJobId === job.id;

              return (
                <button
                  key={job.id}
                  onClick={() => app.handleOpenProject(job.id)}
                  className={`rounded-2xl border p-3 text-left transition active:scale-[0.99] ${
                    active
                      ? "border-white/25 bg-white/10"
                      : "border-white/10 bg-black/35 hover:bg-white/[0.06]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-xs font-black text-white">
                      {job.target || "project"}
                    </p>
                    <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] text-zinc-400">
                      {job.status}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-[11px] leading-4 text-zinc-500">
                    {job.prompt}
                  </p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-white"
                      style={{ width: `${Math.max(0, Math.min(100, job.score || 0))}%` }}
                    />
                  </div>
                </button>
              );
            })
          ) : (
            <p className="rounded-2xl border border-white/10 bg-black/30 p-3 text-xs leading-5 text-zinc-500">
              No project yet. Start an autonomous run.
            </p>
          )}
        </div>
      </div>

      <div className="mt-auto rounded-[1.7rem] border border-emerald-400/15 bg-emerald-500/[0.06] p-4">
        <p className="text-xs font-black text-emerald-200">System</p>
        <p className="mt-1 line-clamp-2 text-xs leading-5 text-emerald-100/60">
          {app.busy ? "Running action…" : app.status}
        </p>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/35 px-2 py-2">
      <p className="truncate text-sm font-black text-white">{value}</p>
      <p className="mt-0.5 text-[9px] uppercase tracking-[0.16em] text-zinc-600">
        {label}
      </p>
    </div>
  );
}
