import type { AutoAppState } from "../hooks/useAutoApp";
import { ActionButton } from "./ActionButton";
import { Panel } from "./Panel";

export function SnapshotsPanel({ app }: { app: AutoAppState }) {
  return (
    <Panel
      title="Snapshots"
      subtitle="Local real browser snapshots. Useful before major AI changes."
    >
      <div className="grid gap-3">
        <ActionButton onClick={app.handleSaveSnapshot} disabled={app.busy}>
          Save current snapshot
        </ActionButton>

        <div className="max-h-[320px] overflow-auto rounded-2xl border border-white/10 bg-black/40 p-2">
          {app.snapshots.length ? (
            app.snapshots.map((snapshot) => (
              <article
                key={snapshot.id}
                className="mb-2 rounded-xl border border-white/10 bg-white/[0.03] p-3"
              >
                <p className="text-sm font-bold text-white">{snapshot.name}</p>

                <p className="mt-1 text-xs text-zinc-500">
                  {snapshot.files.length} files ·{" "}
                  {new Date(snapshot.createdAt).toLocaleString()}
                </p>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => app.handleRestoreSnapshot(snapshot.id)}
                    className="rounded-xl bg-white px-3 py-2 text-xs font-black text-black"
                  >
                    Restore
                  </button>

                  <button
                    onClick={() => app.handleDeleteSnapshot(snapshot.id)}
                    className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs font-black text-red-200"
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))
          ) : (
            <p className="p-3 text-sm text-zinc-500">No snapshots yet.</p>
          )}
        </div>
      </div>
    </Panel>
  );
}
