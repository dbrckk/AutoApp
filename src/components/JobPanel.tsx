type Props = {
  job?: any;
};

export function JobPanel({ job }: Props) {
  if (!job) return null;

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">Generation job</h2>
          <p className="text-xs text-zinc-400">Background-style execution status.</p>
        </div>

        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${
            job.status === "success"
              ? "bg-emerald-400/15 text-emerald-300"
              : job.status === "error"
                ? "bg-red-400/15 text-red-300"
                : "bg-amber-400/15 text-amber-300"
          }`}
        >
          {job.status}
        </span>
      </div>

      {job.error && (
        <div className="mb-3 rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-xs text-red-200">
          {job.error}
        </div>
      )}

      <div className="max-h-56 space-y-2 overflow-auto rounded-2xl border border-white/10 bg-black/25 p-3">
        {(job.logs || []).map((log: string, index: number) => (
          <p key={`${log}-${index}`} className="text-xs leading-5 text-zinc-300">
            {log}
          </p>
        ))}
      </div>
    </section>
  );
}
