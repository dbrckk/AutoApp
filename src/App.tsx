import { useEffect, useMemo, useState } from "react";

import type { VirtualFile } from "./types";

import {
  applyTemplate,
  checkApiHealth,
  checkBuild,
  createDeploymentPack,
  createPublishReport,
  exportToGitHub,
  generateProject,
  getAutonomousJobFiles,
  getAutonomousJobReport,
  getDiagnostics,
  getGitHubFileStatus,
  getLatestGitHubCommit,
  getLiveDiagnostics,
  inspectProject,
  listAutonomousJobs,
  listTemplates,
  resolveDependencies,
  resumeAutonomousJob,
  runAutonomousJobStep,
  scoreProject,
  startRealAutonomousJob,
  testGeminiApi,
  testGitHubAccess,
  testGitHubExport,
  type AutonomousJob,
} from "./lib/api";

const SAMPLE_PROMPT = `Create a complete premium mobile-first SaaS dashboard for creators.
It must include onboarding, dashboard, analytics, settings, export actions, beautiful UI, empty/loading/error states.
github repo: OWNER/REPO
github branch: main`;

export default function App() {
  const [prompt, setPrompt] = useState(SAMPLE_PROMPT);
  const [files, setFiles] = useState<VirtualFile[]>([]);
  const [selectedPath, setSelectedPath] = useState("");
  const [activeJobId, setActiveJobId] = useState("");
  const [jobs, setJobs] = useState<AutonomousJob[]>([]);

  const [githubRepo, setGithubRepo] = useState("");
  const [githubBranch, setGithubBranch] = useState("main");

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Ready.");
  const [result, setResult] = useState<any>(null);
  const [diagnostics, setDiagnostics] = useState<any>(null);

  const selectedFile = useMemo(
    () => files.find((file) => file.path === selectedPath) || files[0],
    [files, selectedPath]
  );

  function buildPromptWithGitHubTarget(rawPrompt: string) {
    const repo = githubRepo.trim();
    const branch = githubBranch.trim() || "main";

    if (!repo) return rawPrompt;

    return [rawPrompt.trim(), "", `github repo: ${repo}`, `github branch: ${branch}`].join("\n");
  }

  async function runAction(label: string, action: () => Promise<any>) {
    setBusy(true);
    setStatus(label);

    try {
      const value = await action();
      setResult(value);
      setStatus("Done.");
      return value;
    } catch (error: any) {
      setStatus(error?.message || "Action failed.");
      throw error;
    } finally {
      setBusy(false);
    }
  }

  async function handleGenerate() {
    await runAction("Generating project...", async () => {
      const response = await generateProject({
        prompt: buildPromptWithGitHubTarget(prompt),
        currentFiles: files,
        buildMode: "virtual",
      });

      const nextFiles = mergeFiles(files, response.files || []);
      setFiles(nextFiles);
      setSelectedPath(nextFiles[0]?.path || "");
      return response;
    });
  }

  async function handleStartAutonomous() {
    await runAction("Starting real autonomous job...", async () => {
      const response = await startRealAutonomousJob({
        prompt: buildPromptWithGitHubTarget(prompt),
      });

      if (!response.ok) {
        throw new Error(response.error || "Autonomous job failed.");
      }

      setActiveJobId(response.jobId);
      await refreshJobs();
      return response;
    });
  }

  async function handleStepJob() {
    if (!activeJobId) return;

    await runAction("Running autonomous step...", async () => {
      const job = await runAutonomousJobStep(activeJobId);
      await refreshJobFiles(activeJobId);
      await refreshJobs();
      return job;
    });
  }

  async function handleResumeJob() {
    if (!activeJobId) return;

    await runAction("Resuming job...", async () => {
      const job = await resumeAutonomousJob(activeJobId);
      await refreshJobs();
      return job;
    });
  }

  async function refreshJobFiles(jobId = activeJobId) {
    if (!jobId) return;

    const data = await getAutonomousJobFiles(jobId);
    setFiles(data.files || []);
    setSelectedPath(data.files?.[0]?.path || "");
    return data;
  }

  async function refreshJobs() {
    const data = await listAutonomousJobs();
    setJobs(data || []);
    return data;
  }

  async function handleExportGitHub() {
    if (!githubRepo.trim()) {
      setStatus("Missing GitHub repo. Example: owner/repo");
      return;
    }

    if (!files.length) {
      setStatus("No files to export.");
      return;
    }

    await runAction("Exporting current files to GitHub...", async () =>
      exportToGitHub({
        repo: githubRepo.trim(),
        branch: githubBranch.trim() || "main",
        commitMessage: "AutoApp manual export",
        files,
      })
    );
  }

  async function handleDiagnostics() {
    await runAction("Running diagnostics...", async () => {
      const data = await getDiagnostics();
      setDiagnostics(data);
      return data;
    });
  }

  async function handleLiveDiagnostics() {
    await runAction("Running live diagnostics...", async () => {
      const data = await getLiveDiagnostics();
      setDiagnostics(data);
      return data;
    });
  }

  async function handleGitHubTest() {
    if (!githubRepo.trim()) {
      setStatus("Missing GitHub repo.");
      return;
    }

    await runAction("Testing GitHub access...", async () =>
      testGitHubAccess({
        repo: githubRepo.trim(),
        branch: githubBranch.trim() || "main",
      })
    );
  }

  async function handleGitHubWriteTest() {
    if (!githubRepo.trim()) {
      setStatus("Missing GitHub repo.");
      return;
    }

    await runAction("Writing test file to GitHub...", async () =>
      testGitHubExport({
        repo: githubRepo.trim(),
        branch: githubBranch.trim() || "main",
      })
    );
  }

  async function handleLatestCommit() {
    if (!githubRepo.trim()) {
      setStatus("Missing GitHub repo.");
      return;
    }

    await runAction("Checking latest GitHub commit...", async () =>
      getLatestGitHubCommit({
        repo: githubRepo.trim(),
        branch: githubBranch.trim() || "main",
      })
    );
  }

  async function handleCheckTestFile() {
    if (!githubRepo.trim()) {
      setStatus("Missing GitHub repo.");
      return;
    }

    await runAction("Checking .autoapp-test.json...", async () =>
      getGitHubFileStatus({
        repo: githubRepo.trim(),
        branch: githubBranch.trim() || "main",
        path: ".autoapp-test.json",
      })
    );
  }

  async function handleUtility(action: string) {
    await runAction(action, async () => {
      if (action === "Health") return checkApiHealth();
      if (action === "AI Test") return testGeminiApi();
      if (action === "Build Check") return checkBuild({ files });
      if (action === "Score") return scoreProject(files);
      if (action === "Inspect") return inspectProject(files);
      if (action === "Resolve Dependencies") {
        const data = await resolveDependencies({ files, apply: true });
        if (data.files) setFiles(data.files);
        return data;
      }
      if (action === "Deployment Pack") {
        const extra = await createDeploymentPack(files);
        setFiles(mergeFiles(files, extra));
        return extra;
      }
      if (action === "Publish Report") return createPublishReport(files);
      return null;
    });
  }

  async function handleLoadTemplates() {
    await runAction("Loading templates...", async () => listTemplates());
  }

  async function handleApplyTemplate(id: string) {
    await runAction("Applying template...", async () => {
      const template = await applyTemplate(id);
      setFiles(template.files || []);
      setSelectedPath(template.files?.[0]?.path || "");
      return template;
    });
  }

  useEffect(() => {
    refreshJobs().catch(() => undefined);
  }, []);

  return (
    <main className="min-h-screen bg-[#050505] px-4 py-6 text-white md:px-8">
      <section className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[420px_1fr]">
        <aside className="space-y-5">
          <Panel title="AutoApp">
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              className="min-h-[260px] w-full resize-y rounded-2xl border border-white/10 bg-black/50 p-4 text-sm leading-6 text-white outline-none"
            />

            <div className="mt-4 grid gap-3">
              <button onClick={handleGenerate} disabled={busy} className="primary">
                Generate now
              </button>

              <button onClick={handleStartAutonomous} disabled={busy} className="secondary">
                Start real autonomous job
              </button>

              <button onClick={handleStepJob} disabled={busy || !activeJobId} className="secondary">
                Run one job step
              </button>

              <button onClick={handleResumeJob} disabled={busy || !activeJobId} className="secondary">
                Resume active job
              </button>
            </div>
          </Panel>

          <Panel title="GitHub Real Export">
            <div className="grid gap-3">
              <input
                value={githubRepo}
                onChange={(event) => setGithubRepo(event.target.value)}
                placeholder="owner/repo"
                className="input"
              />

              <input
                value={githubBranch}
                onChange={(event) => setGithubBranch(event.target.value)}
                placeholder="main"
                className="input"
              />

              <button onClick={handleExportGitHub} disabled={busy} className="primary">
                Export current files to GitHub
              </button>

              <button onClick={handleGitHubTest} disabled={busy} className="secondary">
                Test GitHub access
              </button>

              <button onClick={handleGitHubWriteTest} disabled={busy} className="secondary">
                Real write test
              </button>

              <button onClick={handleLatestCommit} disabled={busy} className="secondary">
                Check latest commit
              </button>

              <button onClick={handleCheckTestFile} disabled={busy} className="secondary">
                Check test file
              </button>
            </div>
          </Panel>

          <Panel title="Diagnostics">
            <div className="grid gap-3">
              <button onClick={handleDiagnostics} disabled={busy} className="secondary">
                Diagnostics
              </button>
              <button onClick={handleLiveDiagnostics} disabled={busy} className="secondary">
                Live diagnostics
              </button>
              <button onClick={() => handleUtility("Health")} disabled={busy} className="secondary">
                Health
              </button>
              <button onClick={() => handleUtility("AI Test")} disabled={busy} className="secondary">
                AI test
              </button>
            </div>
          </Panel>

          <Panel title="Project Tools">
            <div className="grid gap-3">
              {["Build Check", "Score", "Inspect", "Resolve Dependencies", "Deployment Pack", "Publish Report"].map(
                (item) => (
                  <button key={item} onClick={() => handleUtility(item)} disabled={busy} className="secondary">
                    {item}
                  </button>
                )
              )}
              <button onClick={handleLoadTemplates} disabled={busy} className="secondary">
                Load templates
              </button>
              <button onClick={() => handleApplyTemplate("saas")} disabled={busy} className="secondary">
                Apply SaaS template
              </button>
              <button onClick={() => handleApplyTemplate("web-game")} disabled={busy} className="secondary">
                Apply game template
              </button>
            </div>
          </Panel>
        </aside>

        <section className="space-y-5">
          <Panel title="Status">
            <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
              <p className="text-sm text-zinc-300">{busy ? "Working..." : status}</p>
              {activeJobId ? <p className="mt-2 text-xs text-zinc-500">Active job: {activeJobId}</p> : null}
            </div>
          </Panel>

          <Panel title="Jobs">
            <div className="grid gap-3">
              {jobs.length ? (
                jobs.map((job) => (
                  <button
                    key={job.id}
                    onClick={() => {
                      setActiveJobId(job.id);
                      refreshJobFiles(job.id).catch(() => undefined);
                    }}
                    className="rounded-2xl border border-white/10 bg-black/40 p-4 text-left hover:bg-white/5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-black">{job.target}</span>
                      <span className="rounded-full bg-white/10 px-3 py-1 text-xs">{job.status}</span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs text-zinc-400">{job.prompt}</p>
                    <p className="mt-2 text-xs text-zinc-500">
                      phase {job.phase} · score {job.score}/100 · attempts {job.attempts}/{job.max_attempts}
                    </p>
                  </button>
                ))
              ) : (
                <p className="text-sm text-zinc-500">No jobs loaded.</p>
              )}
            </div>
          </Panel>

          <Panel title={`Files (${files.length})`}>
            <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
              <div className="max-h-[520px] overflow-auto rounded-2xl border border-white/10 bg-black/40 p-2">
                {files.map((file) => (
                  <button
                    key={file.path}
                    onClick={() => setSelectedPath(file.path)}
                    className={`block w-full rounded-xl px-3 py-2 text-left text-xs ${
                      selectedFile?.path === file.path ? "bg-white text-black" : "text-zinc-300 hover:bg-white/10"
                    }`}
                  >
                    {file.path}
                  </button>
                ))}
              </div>

              <pre className="max-h-[520px] overflow-auto rounded-2xl border border-white/10 bg-black/60 p-4 text-xs leading-5 text-zinc-300">
                {selectedFile?.content || "No file selected."}
              </pre>
            </div>
          </Panel>

          <Panel title="Result">
            <pre className="max-h-[520px] overflow-auto rounded-2xl border border-white/10 bg-black/60 p-4 text-xs leading-5 text-zinc-300">
              {JSON.stringify(result || diagnostics || {}, null, 2)}
            </pre>
          </Panel>
        </section>
      </section>
    </main>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl">
      <h2 className="mb-4 text-lg font-black text-white">{title}</h2>
      {children}
    </section>
  );
}

function mergeFiles(currentFiles: VirtualFile[], changedFiles: VirtualFile[]) {
  const map = new Map<string, VirtualFile>();

  for (const file of currentFiles || []) {
    map.set(normalizePath(file.path), {
      path: normalizePath(file.path),
      content: file.content,
    });
  }

  for (const file of changedFiles || []) {
    const path = normalizePath(file.path);

    if (file.content === null) {
      map.delete(path);
    } else {
      map.set(path, {
        path,
        content: file.content,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => a.path.localeCompare(b.path));
}

function normalizePath(path: string) {
  const value = String(path || "").trim();
  return value.startsWith("/") ? value : `/${value}`;
}
