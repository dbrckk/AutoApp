type Props = {
  resolution?: any;
  loading?: boolean;
  onAnalyze?: () => void;
  onApply?: () => void;
};

export function DependencyPanel({
  resolution,
  loading,
  onAnalyze,
  onApply,
}: Props) {
  const missing = resolution?.missingDependencies || [];

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">Dependencies</h2>
          <p className="text-xs text-zinc-400">
            Detect imports and repair package.json.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={onAnalyze}
          disabled={loading}
          className="rounded-2xl bg-white px-4 py-2 text-xs font-bold text-black disabled:opacity-50"
        >
          {loading ? "Analyzing..." : "Analyze"}
        </button>

        <button
          onClick={onApply}
          disabled={loading || !resolution}
          className="rounded-2xl border border-white/15 px-4 py-2 text-xs font-bold text-white disabled:opacity-40"
        >
          Apply fix
        </button>
      </div>

      {resolution && (
        <div className="mt-4 space-y-3">
          <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
            <p className="text-xs text-zinc-500">Status</p>
            <p className={resolution.ok ? "text-sm font-bold text-emerald-300" : "text-sm font-bold text-amber-300"}>
              {resolution.ok ? "Dependencies look consistent" : "Dependency issues detected"}
            </p>
          </div>

          {missing.length > 0 && (
            <div className="rounded-2xl border border-amber-400/10 bg-amber-400/5 p-3">
              <p className="mb-2 text-xs font-bold text-amber-300">
                Missing dependencies
              </p>

              <div className="flex flex-wrap gap-2">
                {missing.map((dep: string) => (
                  <span
                    key={dep}
                    className="rounded-full border border-white/10 bg-black/30 px-2 py-1 text-[11px] text-zinc-300"
                  >
                    {dep}
                  </span>
                ))}
              </div>
            </div>
          )}

          {resolution.warnings?.length > 0 && (
            <div className="rounded-2xl border border-red-400/10 bg-red-400/5 p-3">
              <p className="mb-2 text-xs font-bold text-red-300">Warnings</p>

              <ul className="space-y-1 text-xs text-zinc-300">
                {resolution.warnings.map((warning: string) => (
                  <li key={warning}>• {warning}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
