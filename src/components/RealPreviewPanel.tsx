type Props = {
  session?: any;
  loading?: boolean;
  onStart?: () => void;
  onStop?: () => void;
};

export function RealPreviewPanel({
  session,
  loading,
  onStart,
  onStop,
}: Props) {
  return (
    <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] shadow-2xl">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-white">Real preview</h2>
          <p className="text-xs text-zinc-500">
            Runs generated project with Vite in a temporary folder.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onStart}
            disabled={loading}
            className="rounded-2xl bg-white px-4 py-2 text-xs font-bold text-black disabled:opacity-50"
          >
            {loading ? "Starting..." : "Start"}
          </button>

          <button
            onClick={onStop}
            disabled={!session || session.status === "stopped"}
            className="rounded-2xl border border-red-400/20 px-4 py-2 text-xs font-bold text-red-300 disabled:opacity-40"
          >
            Stop
          </button>
        </div>
      </div>

      {session && (
        <div className="p-4">
          <div className="mb-3 flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 p-3">
            <div>
              <p className="text-xs text-zinc-500">Status</p>
              <p className="text-sm font-bold text-white">{session.status}</p>
            </div>

            {session.url && (
              <a
                href={session.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-black"
              >
                Open
              </a>
            )}
          </div>

          {session.status === "running" && session.url && (
            <iframe
              title="Real generated app preview"
              src={session.url}
              className="h-[640px] w-full rounded-2xl bg-black"
            />
          )}

          {session.error && (
            <div className="mt-3 rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-xs text-red-200">
              {session.error}
            </div>
          )}

          {session.logs?.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-semibold text-zinc-300">
                Preview logs
              </summary>

              <div className="mt-2 max-h-56 space-y-1 overflow-auto rounded-2xl bg-black/40 p-3">
                {session.logs.map((log: string, index: number) => (
                  <p key={`${log}-${index}`} className="text-xs text-zinc-400">
                    {log}
                  </p>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </section>
  );
                }
