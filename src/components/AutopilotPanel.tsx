type Props = {
  running?: boolean;
  targetScore: number;
  maxIterations: number;
  logs: string[];
  onTargetScoreChange: (value: number) => void;
  onMaxIterationsChange: (value: number) => void;
  onStart: () => void;
  onStop: () => void;
};

export function AutopilotPanel({
  running,
  targetScore,
  maxIterations,
  logs,
  onTargetScoreChange,
  onMaxIterationsChange,
  onStart,
  onStop,
}: Props) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-white">Autopilot</h2>
        <p className="text-xs text-zinc-400">
          Run repeated AI improvements until target score or iteration limit.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label>
          <span className="mb-1 block text-xs text-zinc-500">Target score</span>
          <input
            type="number"
            min={50}
            max={100}
            value={targetScore}
            onChange={(e) => onTargetScoreChange(Number(e.target.value))}
            className="w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none"
          />
        </label>

        <label>
          <span className="mb-1 block text-xs text-zinc-500">Max iterations</span>
          <input
            type="number"
            min={1}
            max={10}
            value={maxIterations}
            onChange={(e) => onMaxIterationsChange(Number(e.target.value))}
            className="w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none"
          />
        </label>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          onClick={onStart}
          disabled={running}
          className="rounded-2xl bg-white px-4 py-2 text-xs font-bold text-black disabled:opacity-50"
        >
          Start autopilot
        </button>

        <button
          onClick={onStop}
          disabled={!running}
          className="rounded-2xl border border-red-400/20 px-4 py-2 text-xs font-bold text-red-300 disabled:opacity-40"
        >
          Stop
        </button>
      </div>

      {logs.length > 0 && (
        <div className="mt-4 max-h-56 space-y-2 overflow-auto rounded-2xl border border-white/10 bg-black/25 p-3">
          {logs.map((log, index) => (
            <p key={`${log}-${index}`} className="text-xs leading-5 text-zinc-300">
              {log}
            </p>
          ))}
        </div>
      )}
    </section>
  );
        }
