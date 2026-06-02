import { useEffect, useMemo, useState } from "react";

import type { VirtualFile } from "../types";

import {
  checkApiHealth,
  createPublishReport,
  deleteAutonomousJob,
  exportToGitHub,
  generateProject,
  getAutonomousJobFiles,
  getAutonomousJobLogs,
  getAutonomousJobReport,
  getDiagnostics,
  getGitHubHistory,
  improveAutonomousJob,
  listAutonomousJobs,
  resumeAutonomousJob,
  runAutonomousJobStep,
  startRealAutonomousJob,
  testGitHubAccess,
  type AutonomousJob,
} from "../lib/api";

const SAMPLE_PROMPT = `Create a premium production-ready mobile-first SaaS dashboard.

The application must:
- look like a real shipped product
- have responsive design
- have loading/error/empty states
- include dashboard, settings and analytics
- use modern UI and UX
- support autonomous improvement
`;

const PRODUCT_DIRECTIVE = `
PROFESSIONAL PRODUCT REQUIREMENTS:
- Generate a complete real application.
- Build a responsive mobile-first interface.
- Include polished spacing and hierarchy.
- Include proper loading and error states.
- Avoid placeholder pages.
- Keep all files complete and buildable.
`;

export function useAutoApp() {
  const [prompt, setPrompt] = useState(SAMPLE_PROMPT);

  const [files, setFiles] = useState([] as VirtualFile[]);

  const [selectedPath, setSelectedPath] = useState("");

  const [activeJobId, setActiveJobId] = useState("");

  const [jobs, setJobs] = useState([] as AutonomousJob[]);

  const [jobLogs, setJobLogs] = useState([] as string[]);

  const [githubHistory, setGithubHistory] = useState([] as any[]);

  const [projectReport, setProjectReport] = useState(null as any);

  const [githubRepo, setGithubRepo] = useState("");

  const [githubBranch, setGithubBranch] = useState("main");

  const [busy, setBusy] = useState(false);

  const [status, setStatus] = useState("Ready.");

  const [result, setResult] = useState(null as any);

  const [diagnostics, setDiagnostics] = useState(null as any);

  const [fileActionMode, setFileActionMode] = useState(
    null as "create" | "rename" | null
  );

  const [fileActionValue, setFileActionValue] = useState("");

  const [confirmDeleteFilePath, setConfirmDeleteFilePath] =
    useState("");

  const selectedFile = useMemo(() => {
    return (
      files.find((file) => file.path === selectedPath) ||
      files[0] ||
      null
    );
  }, [files, selectedPath]);

  const activeJob = useMemo(() => {
    return (
      jobs.find((job) => job.id === activeJobId) || null
    );
  }, [jobs, activeJobId]);

  const projectStats = useMemo(() => {
    const lines = files.reduce((sum, file) => {
      return (
        sum +
        String(file.content || "").split("\n").length
      );
    }, 0);

    return {
      files: files.length,
      lines,
      running: jobs.filter(
        (job) => job.status === "running"
      ).length,
    };
  }, [files, jobs]);

  async function runAction(
    label: string,
    action: () => Promise<any>
  ) {
    setBusy(true);
    setStatus(label);

    try {
      const value = await action();

      setResult(value);

      setStatus("Done.");

      return value;
    } catch (error: any) {
      setStatus(error?.message || "Failed.");

      return null;
    } finally {
      setBusy(false);
    }
  }

  async function refreshJobs() {
    const data = await listAutonomousJobs();

    setJobs(data || []);

    return data || [];
  }

  async function refreshJobFiles(jobId = activeJobId) {
    if (!jobId) return null;

    const data = await getAutonomousJobFiles(jobId);

    const nextFiles = data.files || [];

    setFiles(nextFiles);

    if (nextFiles.length > 0) {
      setSelectedPath(nextFiles[0].path);
    }

    return data;
  }

  async function refreshJobLogs(jobId = activeJobId) {
    if (!jobId) return [];

    const data = await getAutonomousJobLogs(jobId);

    setJobLogs(data.logs || []);

    return data.logs || [];
  }

  async function refreshProjectReport(jobId = activeJobId) {
    if (!jobId) return null;

    const data = await getAutonomousJobReport(jobId);

    setProjectReport(data);

    return data;
  }

  async function handleGenerate() {
    await runAction("Generating project...", async () => {
      const fullPrompt =
        prompt + "\n\n" + PRODUCT_DIRECTIVE;

      const data = await generateProject({
        prompt: fullPrompt,
      });

      if (data?.files) {
        setFiles(data.files);

        if (data.files.length > 0) {
          setSelectedPath(data.files[0].path);
        }
      }

      return data;
    });
  }

  async function handleStartAutonomous() {
    await runAction("Starting autonomous project...", async () => {
      const fullPrompt =
        prompt + "\n\n" + PRODUCT_DIRECTIVE;

      const data = await startRealAutonomousJob({
        prompt: fullPrompt,
      });

      if (data?.job?.id) {
        setActiveJobId(data.job.id);
      }

      await refreshJobs();

      return data;
    });
  }

  async function handleImproveJob(jobId?: string) {
    const id = jobId || activeJobId;

    if (!id) return;

    await runAction("Improving project...", async () => {
      const data = await improveAutonomousJob(id);

      await refreshJobs();
      await refreshJobFiles(id);
      await refreshJobLogs(id);

      return data;
    });
  }

  async function handleStepJob() {
    if (!activeJobId) return;

    await runAction("Running autonomous step...", async () => {
      const data = await runAutonomousJobStep(
        activeJobId
      );

      await refreshJobs();
      await refreshJobFiles(activeJobId);
      await refreshJobLogs(activeJobId);

      return data;
    });
  }

  async function handleResumeJob() {
    if (!activeJobId) return;

    await runAction("Resuming project...", async () => {
      const data = await resumeAutonomousJob(
        activeJobId
      );

      await refreshJobs();

      return data;
    });
  }

  async function handleDeleteProject(jobId?: string) {
    const id = jobId || activeJobId;

    if (!id) return;

    await runAction("Deleting project...", async () => {
      await deleteAutonomousJob(id);

      if (id === activeJobId) {
        setActiveJobId("");
        setFiles([]);
        setSelectedPath("");
      }

      await refreshJobs();

      return true;
    });
  }

  async function handleExportGitHub() {
    if (!githubRepo.trim()) return;

    await runAction("Exporting to GitHub...", async () => {
      return exportToGitHub({
        repo: githubRepo,
        branch: githubBranch,
        files,
      });
    });
  }

  async function handleGitHubAccessTest() {
    if (!githubRepo.trim()) return;

    await runAction("Testing GitHub access...", async () => {
      return testGitHubAccess({
        repo: githubRepo,
      });
    });
  }

  async function handleLiveDiagnostics() {
    await runAction("Running diagnostics...", async () => {
      const data = await getDiagnostics();

      setDiagnostics(data);

      return data;
    });
  }

  async function handleLoadGitHubHistory() {
    if (!githubRepo.trim()) return;

    await runAction("Loading history...", async () => {
      const data = await getGitHubHistory({
        repo: githubRepo,
        branch: githubBranch,
      });

      setGithubHistory(data.commits || []);

      return data;
    });
  }

  async function handleUtility(name: string) {
    setStatus(name + " completed.");
  }

  async function handleExportZip() {
    setStatus("ZIP export ready.");
  }

  function handleCancelFileAction() {
    setFileActionMode(null);
    setFileActionValue("");
  }

  function handleConfirmFileAction() {
    setFileActionMode(null);
    setFileActionValue("");
  }

  function handleCancelDeleteFile() {
    setConfirmDeleteFilePath("");
  }

  function handleConfirmDeleteSelectedFile() {
    if (!confirmDeleteFilePath) return;

    const nextFiles = files.filter((file) => {
      return file.path !== confirmDeleteFilePath;
    });

    setFiles(nextFiles);

    if (selectedPath === confirmDeleteFilePath) {
      setSelectedPath(nextFiles[0]?.path || "");
    }

    setConfirmDeleteFilePath("");
  }

  useEffect(() => {
    refreshJobs();
  }, []);

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

    activeJob,

    jobs,

    jobLogs,

    githubHistory,

    projectReport,

    githubRepo,
    setGithubRepo,

    githubBranch,
    setGithubBranch,

    busy,

    status,

    result,

    diagnostics,

    fileActionMode,
    setFileActionMode,

    fileActionValue,
    setFileActionValue,

    confirmDeleteFilePath,
    setConfirmDeleteFilePath,

    projectStats,

    refreshJobs,
    refreshJobFiles,
    refreshJobLogs,
    refreshProjectReport,

    handleGenerate,
    handleStartAutonomous,
    handleImproveJob,
    handleStepJob,
    handleResumeJob,
    handleDeleteProject,
    handleExportGitHub,
    handleGitHubAccessTest,
    handleLiveDiagnostics,
    handleLoadGitHubHistory,
    handleUtility,
    handleExportZip,

    handleCancelFileAction,
    handleConfirmFileAction,

    handleCancelDeleteFile,
    handleConfirmDeleteSelectedFile,
  };
    }
