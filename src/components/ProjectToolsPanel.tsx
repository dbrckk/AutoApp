import type { AutoAppState } from "../hooks/useAutoApp";
import { ActionButton } from "./ActionButton";
import { Panel } from "./Panel";

const TOOLS = [
  "Build Check",
  "Score",
  "Inspect",
  "Resolve Dependencies",
  "Deployment Pack",
  "Publish Report",
];

export function ProjectToolsPanel({ app }: { app: AutoAppState }) {
  return (
    <Panel title="Project Tools" subtitle="Static checks, packaging, and exports.">
      <div className="grid gap-3">
        {TOOLS.map((tool) => (
          <ActionButton
            key={tool}
            onClick={() => app.handleUtility(tool)}
            disabled={app.busy}
          >
            {tool}
          </ActionButton>
        ))}

        <ActionButton onClick={app.handleExportZip} disabled={app.busy}>
          Export ZIP
        </ActionButton>
