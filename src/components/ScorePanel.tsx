import type { ProjectScore } from "../types";

type Props = {
  score?: ProjectScore;
  nextActions?: string[];
};

const items: Array<keyof ProjectScore> = [
  "total",
  "ui",
  "mobile",
  "performance",
  "accessibility",
  "seo",
  "maintainability",
  "architecture",
  "monetization",
  "reliability",
];

export function ScorePanel({ score, nextActions = [] }: Props) {
  if (!score) return null;

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">Project quality</h2>
          <p className="text-xs text-zinc-400">
            Automatic score from architecture, UI, SEO and reliability checks.
          </p>
        </div>

        <div className="rounded-2xl bg-white px-4 py-2 text-xl font-black text-black">
          {score.total}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((key) => {
          const value = score[key];

          return (
            <div key={key}>
              <div className="mb-1 flex justify-between text-xs">
                <span className="capitalize text-zinc-300">
                  {key.replace(/([A-Z])/g, " $1")}
                </span>
                <span className="font-semibold text-white">{value}</span>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-white"
                  style={{
                    width: `${Math.max(0, Math.min(100, value))}%`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {nextActions.length > 0 && (
        <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-3">
          <p className="mb-2 text-xs font-semibold text-white">Next actions</p>

          <ul className="space-y-1 text-xs text-zinc-300">
            {nextActions.slice(0, 5).map((action) => (
              <li key={action}>• {action}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
                }
