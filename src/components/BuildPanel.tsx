type BuildIssue = {
  type: string;
  file?: string;
  message: string;
  raw: string;
};

type Props = {
  result?: {
    ok: boolean;
    issues: BuildIssue[];
    log: string;
  } | null;
  loading?: boolean;
  onCheckVirtual?: () => void;
  onCheckReal?: () => void;
};

export function BuildPanel({
  result,
  loading,
  onCheckVirtual,
  onCheckReal,
}: Props) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">Build check</h2>
          <p className="text-xs text-zinc-400">
            Verify imports, structure and real production build.
          </p>
        </div>

        {result && (
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              result.ok
                ? "bg-emerald-400/15 text-emerald-300"
                : "bg-red-400/15 text-red-300"
            }`}
          >
            {result.ok ? "PASS" : "FAIL"}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={onCheckVirtual}
          disabled={loading}
          className="rounded-2xl bg-white px-4 py-2 text-xs font-bold text-black disabled:opacity-50"
        >
          Virtual check
        </button>

        <button
          onClick={onCheckReal}
          disabled={loading}
          className="rounded-2xl border border-white/15 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
        >
          Real npm build
        </button>
      </div>

      {loading && (
        <p className="mt-3 text-xs text-zinc-400">
          Build check running...
        </p>
      )}

      {result?.issues?.length > 0 && (
        <div className="mt-4 space-y-2">
          {result.issues.slice(0, 8).map((issue, index) => (
            <div
              key={`${issue.type}-${issue.file}-${index}`}
              className="rounded-2xl border border-red-400/10 bg-red-400/5 p-3"
            >
              <p className="text-xs font-bold text-red-300">
                {issue.type}
                {issue.file ? ` · ${issue.file}` : ""}
              </p>
              <p className="mt-1 text-xs text-zinc-300">{issue.message}</p>
            </div>
          ))}
        </div>
      )}

      {result?.log && (
        <details className="mt-4">
          <summary className="cursor-pointer text-xs font-semibold text-zinc-300">
            Build log
          </summary>

          <pre className="mt-2 max-h-80 overflow-auto rounded-2xl bg-black/50 p-3 text-xs text-zinc-300">
            {result.log}
          </pre>
        </details>
      )}
    </section>
  );
                                         }
