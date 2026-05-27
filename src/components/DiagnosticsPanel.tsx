import type { AutoAppState } from "../hooks/useAutoApp";
import { ActionButton } from "./ActionButton";
import { Panel } from "./Panel";

export function DiagnosticsPanel({ app }: { app: AutoAppState }) {
  return (
    <Panel title="Diagnostics" subtitle="Real checks for Worker, D1, AI, and GitHub.">
      <div className="grid gap-3">
        <ActionButton onClick={app.handleDiagnostics} disabled={app.busy}>
          Diagnostics
        </ActionButton>

        <ActionButton onClick={app.handleLiveDiagnostics} disabled={app.busy}>
          Live diagnostics
        </ActionButton>

        <div className="grid grid-cols-2 gap-3">
          <ActionButton
            onClick={() => app.handleUtility("Health")}
            disabled={app.busy}
          >
            Health
          </ActionButton>

          <ActionButton
            onClick={() => app.handleUtility("AI Test")}
            disabled={app.busy}
          >
            AI test
          </ActionButton>
        </div>
      </div>
    </Panel>
  );
}
