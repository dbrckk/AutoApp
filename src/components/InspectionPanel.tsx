type Props = {
  inspection?: any;
  loading?: boolean;
  onInspect?: () => void;
};

export function InspectionPanel({ inspection, loading, onInspect }: Props) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">Project inspector</h2>
          <p className="text-xs text-zinc-400">
            Detect framework, dependencies, risks and missing files.
          </p>
        </div>

        <button
          onClick={onInspect}
          disabled={loading}
          className="rounded-2xl bg-white px-4 py-2 text-xs font-bold text-black disabled:opacity-50"
        >
          {loading ? "Inspecting..." : "Inspect"}
        </button>
      </div>

      {!inspection && (
        <p className="rounded-2xl border border-dashed border-white/10 p-4 text-xs text-zinc-500">
          No inspection yet.
        </p>
      )}

      {inspection && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <Info label="Framework" value={inspection.framework} />
            <Info label="Language" value={inspection.language} />
            <Info label="Package manager" value={inspection.packageManager} />
            <Info label="Entrypoints" value={inspection.entrypoints?.length || 0} />
          </div>

          <List title="Missing critical files" items={inspection.missingCriticalFiles} tone="red" />
          <List title="Risks" items={inspection.risks} tone="amber" />
          <List title="Strengths" items={inspection.strengths} tone="green" />

          <details>
            <summary className="cursor-pointer text-xs font-semibold text-zinc-300">
              Dependencies
            </summary>

            <div className="mt-2 flex flex-wrap gap-2">
              {[...(inspection.dependencies || []), ...(inspection.devDependencies || [])].map(
                (dep) => (
                  <span
                    key={dep}
                    className="rounded-full border border-white/10 bg-black/30 px-2 py-1 text-[11px] text-zinc-300"
                  >
                    {dep}
                  </span>
                )
              )}
            </div>
          </details>
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

function List({
  title,
  items = [],
  tone,
}: {
  title: string;
  items: string[];
  tone: "red" | "amber" | "green";
}) {
  const toneClass =
    tone === "red"
      ? "text-red-300"
      : tone === "amber"
        ? "text-amber-300"
        : "text-emerald-300";

  if (!items.length) return null;

  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
      <p className={`mb-2 text-xs font-bold ${toneClass}`}>{title}</p>

      <ul className="space-y-1 text-xs text-zinc-300">
        {items.slice(0, 8).map((item) => (
          <li key={item}>• {item}</li>
        ))}
      </ul>
    </div>
  );
        }
