type Props = {
  report?: any;
  loading?: boolean;
  onGenerate?: () => void;
};

export function PublishPanel({ report, loading, onGenerate }: Props) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">Publish assistant</h2>
          <p className="text-xs text-zinc-400">
            Checks whether the project is ready for GitHub/Vercel.
          </p>
        </div>

        <button
          onClick={onGenerate}
          disabled={loading}
          className="rounded-2xl bg-white px-4 py-2 text-xs font-bold text-black disabled:opacity-50"
        >
          {loading ? "Checking..." : "Check"}
        </button>
      </div>

      {!report && (
        <p className="rounded-2xl border border-dashed border-white/10 p-4 text-xs text-zinc-500">
          No publish report yet.
        </p>
      )}

      {report && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
            <p className="text-xs text-zinc-500">Readiness</p>
            <p
              className={
                report.ready
                  ? "text-sm font-bold text-emerald-300"
                  : "text-sm font-bold text-red-300"
              }
            >
              {report.ready ? "Ready to publish" : "Not ready"} · {report.score}/100
            </p>
          </div>

          <List title="Blockers" items={report.blockers} tone="red" />
          <List title="Warnings" items={report.warnings} tone="amber" />
          <List title="Checklist" items={report.checklist} tone="green" />

          {report.commands?.length > 0 && (
            <details>
              <summary className="cursor-pointer text-xs font-semibold text-zinc-300">
                GitHub commands
              </summary>

              <pre className="mt-2 overflow-auto rounded-2xl bg-black/50 p-3 text-xs text-zinc-300">
                {report.commands.join("\n")}
              </pre>
            </details>
          )}
        </div>
      )}
    </section>
  );
}

function List({
  title,
  items = [],
  tone,
}: {
  title: string;
  items: string[];
  tone: "red" | "amber" | "green";
}) {
  if (!items.length) return null;

  const color =
    tone === "red"
      ? "text-red-300"
      : tone === "amber"
        ? "text-amber-300"
        : "text-emerald-300";

  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
      <p className={`mb-2 text-xs font-bold ${color}`}>{title}</p>
      <ul className="space-y-1 text-xs text-zinc-300">
        {items.map((item) => (
          <li key={item}>• {item}</li>
        ))}
      </ul>
    </div>
  );
          }
