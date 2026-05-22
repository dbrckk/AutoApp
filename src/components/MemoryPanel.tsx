type Props = {
  memory?: any;
  loading?: boolean;
  onLoad?: () => void;
};

export function MemoryPanel({ memory, loading, onLoad }: Props) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">Project memory</h2>
          <p className="text-xs text-zinc-400">
            Architecture, build history, recurring problems and successful fixes.
          </p>
        </div>

        <button
          onClick={onLoad}
          disabled={loading}
          className="rounded-2xl bg-white px-4 py-2 text-xs font-bold text-black disabled:opacity-50"
        >
          {loading ? "Loading..." : "Load"}
        </button>
      </div>

      {!memory ? (
        <p className="rounded-2xl border border-dashed border-white/10 p-4 text-xs text-zinc-500">
          No memory loaded.
        </p>
      ) : (
        <div className="space-y-3">
          <Info label="Project ID" value={memory.projectId} />
          <Info label="Builds" value={memory.buildHistory?.length || 0} />
          <List title="Recurring problems" items={memory.recurringProblems} />
          <List title="Successful fixes" items={memory.successfulFixes} />
          <List title="Architecture notes" items={memory.architectureNotes} />
        </div>
      )}
    </section>
  );
}

function Info({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
      <p className="text-[11px] text-zinc-500">{label}</p>
      <p className="mt-1 truncate text-xs font-bold text-white">{String(value || "—")}</p>
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
