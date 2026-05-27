import type { AutoAppState } from "../hooks/useAutoApp";
import { ActionButton } from "./ActionButton";
import { Panel } from "./Panel";

export function GitHubPanel({ app }: { app: AutoAppState }) {
  return (
    <Panel
      title="GitHub Real Export"
      subtitle="Uses GITHUB_TOKEN stored in Cloudflare Worker secrets. No token is stored in the browser."
    >
      <div className="grid gap-3">
        <input
          value={app.githubRepo}
          onChange={(event) => app.setGithubRepo(event.target.value)}
          placeholder="owner/repo"
          className="rounded-2xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white outline-none focus:border-white/30"
        />

        <input
          value={app.githubBranch}
          onChange={(event) => app.setGithubBranch(event.target.value)}
          placeholder="main"
          className="rounded-2xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white outline-none focus:border-white/30"
        />

        <ActionButton
          onClick={app.handleExportGitHub}
          disabled={app.busy}
          variant="primary"
        >
          Export current files to GitHub
        </ActionButton>

        <div className="grid grid-cols-2 gap-3">
          <ActionButton onClick={app.handleGitHubAccessTest} disabled={app.busy}>
            Test access
          </ActionButton>

          <ActionButton onClick={app.handleGitHubWriteTest} disabled={app.busy}>
            Write test
          </ActionButton>

          <ActionButton onClick={app.handleLatestCommit} disabled={app.busy}>
            Latest commit
          </ActionButton>

          <ActionButton onClick={app.handleCheckTestFile} disabled={app.busy}>
            Test file
          </ActionButton>
        </div>
      </div>
    </Panel>
  );
}
