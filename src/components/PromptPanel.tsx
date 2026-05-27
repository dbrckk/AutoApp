import type { AutoAppState } from "../hooks/useAutoApp";
import { ActionButton } from "./ActionButton";
import { Panel } from "./Panel";

export function PromptPanel({ app }: { app: AutoAppState }) {
  return (
    <Panel
      title="AutoApp Builder"
      subtitle="Generate, improve, continue, and export real projects."
    >
      <textarea
        value={app.prompt}
        onChange={(event) => app.setPrompt(event.target.value)}
        className="min-h-[260px] w-full resize-y rounded-2xl border border-white/10 bg-black/50 p-4 text-sm leading-6 text-white outline-none focus:border-white/30"
      />

      <div className="mt-4 grid gap-3">
        <ActionButton
          onClick={app.handleGenerate}
          disabled={app.busy}
          variant="primary"
        >
          Generate now
        </ActionButton>

        <ActionButton
          onClick={app.handleStartAutonomous}
          disabled={app.busy}
        >
          Start real autonomous job
        </ActionButton>

        <ActionButton
          onClick={app.handleStepJob}
          disabled={app.busy || !app.activeJobId}
        >
          Run one job step
        </ActionButton>

        <ActionButton
          onClick={app.handleResumeJob}
          disabled={app.busy || !app.activeJobId}
        >
          Resume selected job
        </ActionButton>
      </div>
    </Panel>
  );
}
