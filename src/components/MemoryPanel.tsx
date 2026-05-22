type Props = {
  memory?: any;
  loading?: boolean;
  onLoad?: () => void;
  onReset?: () => void;
};

export function MemoryPanel({ memory, loading, onLoad, onReset }: Props) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">Project memory</h2>
          <p className="text-xs text-zinc-400">
            Architecture, build history, recurring problems and successful fixes.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onLoad}
            disabled={loading}
            className="rounded-2xl bg-white px-4 py-2 text-xs font-bold text-black disabled:opacity-50"
          >
            {loading ? "Loading..." : "Load"}
          </button>

          <button
            onClick={onReset}
            disabled={loading}
            className="rounded-2xl border border-red-400/20 px-4 py-2 text-xs font-bold text-red-300 disabled:opacity-50"
          >
            Reset
          </button>
        </div>
      </div>

      {!memory ? (
        <p className="rounded-2xl border border-dashed border-white/10 p-4 text-xs text-zinc-500">
          No memory loaded.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Info label="Project ID" value={memory.projectId} />
            <Info label="Builds" value={memory.buildHistory?.length || 0} />
            <Info label="Framework" value={memory.framework || "—"} />
            <Info label="Language" value={memory.language || "—"} />
          </div>

          <List title="Recurring problems" items={memory.recurringProblems} />
          <List title="Successful fixes" items={memory.successfulFixes} />
          <List title="Architecture notes" items={memory.architectureNotes} />
          <List title="Preferred libraries" items={memory.preferredLibraries} />
          <List title="Rejected patterns" items={memory.rejectedPatterns} />

          {memory.aiDecisions?.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
              <p className="mb-2 text-xs font-bold text-white">Recent AI decisions</p>

              <ul className="space-y-2 text-xs text-zinc-300">
                {memory.aiDecisions.slice(0, 5).map((decision: any, index: number) => (
                  <li key={`${decision.timestamp}-${index}`}>
                    <span className="text-zinc-500">
                      {decision.type || "decision"} ·{" "}
                      {decision.timestamp
                        ? new Date(decision.timestamp).toLocaleString()
                        : "unknown time"}
                    </span>
                    <p className="mt-1 leading-5">{decision.summary}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Info({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
      <p className="text-[11px] text-zinc-500">{label}</p>
      <p className="mt-1 truncate text-xs font-bold text-white">
        {String(value || "—")}
      </p>
    </div>
  );
}

function List({ title, items = [] }: { title: string; items?: string[] }) {
  if (!items.length) return null;

  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
      <p className="mb-2 text-xs font-bold text-white">{title}</p>

      <ul className="space-y-1 text-xs text-zinc-300">
        {items.slice(0, 8).map((item) => (
          <li key={item}>• {item}</li>
        ))}
      </ul>
    </div>
  );
              }
