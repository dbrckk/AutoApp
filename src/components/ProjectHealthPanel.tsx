type Props = {
  score?: any;
  buildResult?: any;
  publishReport?: any;
  memory?: any;
};

export function ProjectHealthPanel({
  score,
  buildResult,
  publishReport,
  memory,
}: Props) {
  const buildOk = buildResult?.ok;
  const publishReady = publishReport?.ready;
  const totalScore = score?.total ?? 0;

  const status =
    buildOk && publishReady && totalScore >= 85
      ? "Excellent"
      : buildOk && totalScore >= 75
        ? "Good"
        : buildOk
          ? "Needs polish"
          : "Needs repair";

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-white">Project health</h2>
        <p className="text-xs text-zinc-400">
          Global readiness summary.
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
        <p className="text-xs text-zinc-500">Status</p>
        <p className="mt-1 text-2xl font-black text-white">{status}</p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <Item label="Score" value={`${totalScore}/100`} />
        <Item label="Build" value={buildOk ? "PASS" : buildResult ? "FAIL" : "—"} />
        <Item label="Publish" value={publishReady ? "READY" : publishReport ? "BLOCKED" : "—"} />
        <Item label="Memory" value={memory ? "LOADED" : "—"} />
      </div>

      {publishReport?.blockers?.length > 0 && (
        <div className="mt-3 rounded-2xl border border-red-400/20 bg-red-500/10 p-3">
          <p className="mb-2 text-xs font-bold text-red-300">Blockers</p>
          <ul className="space-y-1 text-xs text-red-100">
            {publishReport.blockers.slice(0, 4).map((item: string) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
      <p className="text-[11px] text-zinc-500">{label}</p>
      <p className="mt-1 font-bold text-white">{value}</p>
    </div>
  );
          }
