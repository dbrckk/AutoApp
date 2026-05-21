type Props = {
  actions?: string[];
  loading?: boolean;
  onRunAction?: (action: string) => void;
  onRunAll?: () => void;
};

export function ActionQueuePanel({
  actions = [],
  loading,
  onRunAction,
  onRunAll,
}: Props) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">Action queue</h2>
          <p className="text-xs text-zinc-400">
            Turn project weaknesses into direct AI improvement tasks.
          </p>
        </div>

        <button
          onClick={onRunAll}
          disabled={loading || actions.length === 0}
          className="rounded-2xl bg-white px-4 py-2 text-xs font-bold text-black disabled:opacity-40"
        >
          Run all
        </button>
      </div>

      {actions.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/10 p-4 text-xs text-zinc-500">
          No action available.
        </p>
      ) : (
        <div className="space-y-2">
          {actions.slice(0, 8).map((action) => (
            <div
              key={action}
              className="rounded-2xl border border-white/10 bg-black/25 p-3"
            >
              <p className="text-xs leading-5 text-zinc-300">{action}</p>

              <button
                onClick={() => onRunAction?.(action)}
                disabled={loading}
                className="mt-2 rounded-xl border border-white/10 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-white/10 disabled:opacity-40"
              >
                Run task
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
