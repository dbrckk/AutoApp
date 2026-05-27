import { useEffect, useMemo, useState } from "react";

import type { VirtualFile } from "../types";

import {
  applyTemplate,
  checkApiHealth,
  checkBuild,
  createDeploymentPack,
  createPublishReport,
  exportToGitHub,
  generateProject,
  getAutonomousJobFiles,
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
} from "../lib/api";

const SAMPLE_PROMPT = `Create a complete premium mobile-first SaaS dashboard for creators.
It must include onboarding, dashboard, analytics, settings, export actions, beautiful UI, empty/loading/error states.`;

export function useAutoApp() {
  const [prompt, setPrompt] = useState(SAMPLE_PROMPT);
  const [files, setFiles] = useState<VirtualFile[]>([]);
  const [selectedPath, setSelectedPath] = useState("");
  const [activeJobId, setActiveJobId] = useState("");
  const [jobs, setJobs] = useState<AutonomousJob[]>([]);

  const [githubRepo, setGithubRepo] = useState("");
  const [githubBranch, setGithubBranch] = useState("main");

  const [autoRefreshJobs, setAutoRefreshJobs] = useState(true);

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Ready.");
  const [result, setResult] = useState<any>(null);
  const [diagnostics, setDiagnostics] = useState<any>(null);

  const selectedFile = useMemo(
    () => files.find((file) => file.path === selectedPath) || files[0] || null,
    [files, selectedPath]
  );

  function buildPromptWithGitHubTarget(rawPrompt: string) {
    const repo = githubRepo.trim();
    const branch = githubBranch.trim() || "main";

    if (!repo) return rawPrompt;

    return [
      rawPrompt.trim(),
      "",
      `github repo: ${repo}`,
      `github branch: ${branch}`,
    ].join("\n");
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
      const message = error?.message || "Action failed.";
      setStatus(message);
      setResult({ ok: false, error: message });
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function refreshJobs() {
    const data = await listAutonomousJobs();
    setJobs(data || []);
    return data;
  }

  async function refreshJobFiles(jobId = activeJobId) {
    if (!jobId) return null;

    const data = await getAutonomousJobFiles(jobId);
    const nextFiles = data.files || [];

    setFiles(nextFiles);
    setSelectedPath(nextFiles[0]?.path || "");

    return data;
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
    if (!activeJobId) {
      setStatus("No active job selected.");
      return;
    }

    await runAction("Running autonomous step...", async () => {
      const job = await runAutonomousJobStep(activeJobId);
      await refreshJobFiles(activeJobId);
      await refreshJobs();
      return job;
    });
  }

  async function handleResumeJob() {
    if (!activeJobId) {
      setStatus("No active job selected.");
      return;
    }

    await runAction("Resuming job...", async () => {
      const job = await resumeAutonomousJob(activeJobId);
      await refreshJobs();
      return job;
    });
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

  async function handleGitHubAccessTest() {
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

    await runAction("Writing real test file to GitHub...", async () =>
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

  async function handleUtility(action: string) {
    await runAction(action, async () => {
      if (action === "Health") return checkApiHealth();
      if (action === "AI Test") return testGeminiApi();
      if (action === "Build Check") return checkBuild({ files });
      if (action === "Score") return scoreProject(files);
      if (action === "Inspect") return inspectProject(files);

      if (action === "Resolve Dependencies") {
        const data = await resolveDependencies({ files, apply: true });

        if (data.files) {
          setFiles(data.files);
          setSelectedPath(data.files[0]?.path || "");
        }

        return data;
      }

      if (action === "Deployment Pack") {
        const extra = await createDeploymentPack(files);
        const nextFiles = mergeFiles(files, extra);

        setFiles(nextFiles);
        setSelectedPath(nextFiles[0]?.path || "");

        return extra;
      }

      if (action === "Publish Report") {
        return createPublishReport(files);
      }

      return null;
    });
  }

  async function handleLoadTemplates() {
    await runAction("Loading templates...", async () => listTemplates());
  }

  async function handleApplyTemplate(id: string) {
    await runAction("Applying template...", async () => {
      const template = await applyTemplate(id);
      const templateFiles = template.files || [];

      setFiles(templateFiles);
      setSelectedPath(templateFiles[0]?.path || "");

      return template;
    });
  }

  useEffect(() => {
    refreshJobs().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!autoRefreshJobs) return;

    const timer = window.setInterval(() => {
      refreshJobs().catch(() => undefined);

      if (activeJobId) {
        refreshJobFiles(activeJobId).catch(() => undefined);
      }
    }, 15_000);

    return () => window.clearInterval(timer);
  }, [autoRefreshJobs, activeJobId]);

  return {
    prompt,
    setPrompt,

    files,
    setFiles,

    selectedPath,
    setSelectedPath,
    selectedFile,

    activeJobId,
    setActiveJobId,

    jobs,
    refreshJobs,
    refreshJobFiles,

    githubRepo,
    setGithubRepo,
    githubBranch,
    setGithubBranch,

    autoRefreshJobs,
    setAutoRefreshJobs,

    busy,
    status,
    result,
    diagnostics,

    handleGenerate,
    handleStartAutonomous,
    handleStepJob,
    handleResumeJob,

    handleExportGitHub,
    handleGitHubAccessTest,
    handleGitHubWriteTest,
    handleLatestCommit,
    handleCheckTestFile,

    handleDiagnostics,
    handleLiveDiagnostics,
    handleUtility,
    handleLoadTemplates,
    handleApplyTemplate,
  };
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

export type AutoAppState = ReturnType<typeof useAutoApp>;
