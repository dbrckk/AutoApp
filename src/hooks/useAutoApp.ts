import { useEffect, useMemo, useState } from "react";

import type { VirtualFile } from "../types";

import { exportFilesAsZip } from "../lib/exportZip";
import { deleteSnapshot, listSnapshots, saveSnapshot, type ProjectSnapshot } from "../lib/snapshots";
import {
  applyTemplate,
  checkApiHealth,
  checkBuild,
  createDeploymentPack,
  createPublishReport,
  deleteAutonomousJob,
  exportToGitHub,
  generateProject,
  getAutonomousJobFiles,
  getAutonomousJobLogs,
  getAutonomousJobReport,
  getDiagnostics,
  getGitHubFileStatus,
  getGitHubHistory,
  getLatestGitHubCommit,
  getLiveDiagnostics,
  improveAutonomousJob,
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
  createPipelinePlan,
  runPipelineAutofix,
  runPipelineQuality,
} from "../lib/api";

const SAMPLE_PROMPT = `Create a premium production-ready mobile-first SaaS dashboard for creators.

The app must feel like a real shipped product, not a demo. It needs onboarding, dashboard, analytics, settings, export actions, empty/loading/error states, persistent local state, polished responsive UI, clear navigation, premium dark design, and production-ready code.

auto improve forever: true`;

const PRODUCT_DIRECTIVE = `
PROFESSIONAL PRODUCT REQUIREMENTS:
- Generate a complete real application, not a placeholder.
- Build a mobile-first production interface with clear navigation.
- Include real empty, loading and error states.
- Include onboarding, dashboard, settings and export workflows when relevant.
- Add local persistence where useful.
- Add polished UI, spacing, hierarchy, accessibility and responsive behavior.
- Keep all files complete and buildable.
- Avoid coming soon screens, lorem ipsum, placeholder-only features and mock-only pages.
- If this is a game, create real gameplay systems, progression, upgrades, scoring, retention and Android-readiness.
- If this is a SaaS, create real product screens, analytics, settings, exports and onboarding.
`;

type NotificationItem = { id: string; type: "success" | "error" | "info"; title: string; message?: string };
type ActivityItem = { id: string; at: number; type: string; title: string; message?: string };

export function useAutoApp() {
  const [prompt, setPrompt] = useState(SAMPLE_PROMPT);
  const [files, setFiles] = useState([] as VirtualFile[]);
  const [selectedPath, setSelectedPath] = useState("");
  const [activeJobId, setActiveJobId] = useState("");
  const [jobs, setJobs] = useState([] as AutonomousJob[]);
  const [jobLogs, setJobLogs] = useState([] as string[]);
  const [projectReport, setProjectReport] = useState(null as any);
  const [githubHistory, setGithubHistory] = useState([] as any[]);
  const [githubRepo, setGithubRepo] = useState("");
  const [githubBranch, setGithubBranch] = useState("main");
  const [autoRefreshJobs, setAutoRefreshJobs] = useState(true);
  const [snapshots, setSnapshots] = useState(listSnapshots() as ProjectSnapshot[]);
  const [fileActionMode, setFileActionMode] = useState(null as "create" | "rename" | null);
  const [fileActionValue, setFileActionValue] = useState("");
  const [confirmDeleteFilePath, setConfirmDeleteFilePath] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Ready.");
  const [result, setResult] = useState(null as any);
  const [diagnostics, setDiagnostics] = useState(null as any);
  const [activeTab, setActiveTab] = useState("projects");
  const [notifications, setNotifications] = useState([] as NotificationItem[]);
  const [activityEvents, setActivityEvents] = useState([] as ActivityItem[]);

  const selectedFile = useMemo(() => files.find((file) => file.path === selectedPath) || files[0] || null, [files, selectedPath]);
  const activeJob = useMemo(() => jobs.find((job) => job.id === activeJobId) || null, [jobs, activeJobId]);

  const projectStats = useMemo(() => {
    const lines = files.reduce((sum, file) => sum + String(file.content || "").split("\n").length, 0);
    const chars = files.reduce((sum, file) => sum + String(file.content || "").length, 0);
    return {
      files: files.length,
      lines,
      chars,
      jobs: jobs.length,
      running: jobs.filter((job) => job.status === "running").length,
      done: jobs.filter((job) => job.status === "done").length,
    };
  }, [files, jobs]);

  const sessionSnapshotAvailable = false;

  function pushActivity(type: "success" | "error" | "info", title: string, message?: string) {
    const item = { id: crypto.randomUUID(), at: Date.now(), type, title, message };
    setActivityEvents((previous) => [item, ...previous].slice(0, 80));
    setNotifications((previous) => [item, ...previous].slice(0, 5));
    window.setTimeout(() => {
      setNotifications((previous) => previous.filter((entry) => entry.id !== item.id));
    }, 4200);
  }

  function dismissNotification(id: string) {
    setNotifications((previous) => previous.filter((entry) => entry.id !== id));
  }

  function clearActivityEvents() { setActivityEvents([]); }
  function restoreFrontendSnapshot() { setStatus("No local recovery snapshot available."); }
  function dismissFrontendSnapshot() { setStatus("Recovery dismissed."); }

  function buildPromptWithGitHubTarget(rawPrompt: string) {
    const repo = githubRepo.trim();
    const branch = githubBranch.trim() || "main";
    const lines = [rawPrompt.trim(), "", PRODUCT_DIRECTIVE.trim()];
    if (!/auto\s*improve\s*forever\s*:\s*true/i.test(rawPrompt)) lines.push("", "auto improve forever: true");
    if (repo && !/github\s*repo\s*:/i.test(rawPrompt)) lines.push(`github repo: ${repo}`);
    if (repo && !/github\s*branch\s*:/i.test(rawPrompt)) lines.push(`github branch: ${branch}`);
    return lines.join("\n");
  }

  async function runAction(label: string, action: () => Promise<any>) {
    setBusy(true);
    setStatus(label);
    try {
      const value = await action();
      setResult(value);
      setStatus("Done.");
      pushActivity("success", label, "Action completed.");
      return value;
    } catch (error: any) {
      const message = error?.message || "Action failed.";
      setStatus(message);
      setResult({ ok: false, error: message });
      pushActivity("error", label, message);
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
    setSelectedPath((current) => nextFiles.some((file) => file.path === current) ? current : nextFiles[0]?.path || "");
    return data;
  }

  async function refreshJobLogs(jobId = activeJobId) {
    if (!jobId) return [];
    const data = await getAutonomousJobLogs(jobId);
    const logs = data.logs || [];
    setJobLogs(logs);
    return logs;
  }

  async function refreshProjectReport(jobId = activeJobId) {
    if (!jobId) { setProjectReport(null); return null; }
    const report = await getAutonomousJobReport(jobId);
    setProjectReport(report);
    return report;
  }

  async function handleLoadJobLogs(jobId = activeJobId) { await runAction("Loading logs...", async () => refreshJobLogs(jobId)); }

  async function handleLoadGitHubHistory() {
    if (!githubRepo.trim()) { setStatus("Missing GitHub repo."); return; }
    await runAction("Loading GitHub history...", async () => {
      const data = await getGitHubHistory({ repo: githubRepo.trim(), branch: githubBranch.trim() || "main" });
      const commits = data.commits || [];
      setGithubHistory(commits);
      return data;
    });
  }

  async function handleOpenProject(jobId: string) {
    setActiveJobId(jobId);
    setActiveTab("overview");
    await runAction("Opening project...", async () => {
      const [filesData, logsData, reportData] = await Promise.allSettled([refreshJobFiles(jobId), refreshJobLogs(jobId), refreshProjectReport(jobId)]);
      return { ok: true, files: filesData.status === "fulfilled" ? filesData.value?.files || [] : [], logs: logsData.status === "fulfilled" ? logsData.value || [] : [], report: reportData.status === "fulfilled" ? reportData.value : null };
    });
  }

  async function handleDeleteProject(jobId = activeJobId) {
    if (!jobId) { setStatus("No project selected."); return; }
    const job = jobs.find((entry) => entry.id === jobId);
    const name = job?.target || job?.id || "project";
    if (!window.confirm(`Delete project "${name}" permanently?`)) return;
    await runAction("Deleting project...", async () => {
      const response = await deleteAutonomousJob(jobId);
      if (activeJobId === jobId) { setActiveJobId(""); setFiles([]); setSelectedPath(""); setJobLogs([]); setProjectReport(null); }
      await refreshJobs();
      return response;
    });
  }

  function refreshSnapshots() { setSnapshots(listSnapshots()); }

  function handleSaveSnapshot() {
    if (!files.length) { setStatus("No files to snapshot."); return; }
    const snapshot = saveSnapshot(`Snapshot ${new Date().toLocaleString()}`, files);
    refreshSnapshots();
    setResult({ ok: true, snapshot });
    setStatus("Snapshot saved.");
  }

  function handleRestoreSnapshot(id: string) {
    const snapshot = snapshots.find((item) => item.id === id);
    if (!snapshot) { setStatus("Snapshot not found."); return; }
    setFiles(snapshot.files);
    setSelectedPath(snapshot.files[0]?.path || "");
    setResult({ ok: true, restored: snapshot });
    setStatus(`Snapshot restored: ${snapshot.name}`);
  }

  function handleDeleteSnapshot(id: string) { setSnapshots(deleteSnapshot(id)); setStatus("Snapshot deleted."); }

  async function handleGenerate() {
    await runAction("Generating premium project...", async () => {
      const response = await generateProject({ prompt: buildPromptWithGitHubTarget(prompt), currentFiles: files, buildMode: "virtual" });
      const nextFiles = mergeFiles(files, response.files || []);
      setFiles(nextFiles);
      setSelectedPath(nextFiles[0]?.path || "");
      return response;
    });
  }

  async function handleStartAutonomous() {
    await runAction("Starting professional autonomous job...", async () => {
      const response = await startRealAutonomousJob({ prompt: buildPromptWithGitHubTarget(prompt) });
      if (!response.ok) throw new Error(response.error || "Autonomous job failed.");
      setActiveJobId(response.jobId);
      setActiveTab("overview");
      await refreshJobs();
      await refreshJobFiles(response.jobId);
      await refreshJobLogs(response.jobId);
      await refreshProjectReport(response.jobId);
      return response;
    });
  }

  async function handleStepJob() {
    if (!activeJobId) { setStatus("No active job selected."); return; }
    await runAction("Running one autonomous step...", async () => {
      const job = await runAutonomousJobStep(activeJobId);
      await refreshJobFiles(activeJobId);
      await refreshJobLogs(activeJobId);
      await refreshProjectReport(activeJobId);
      await refreshJobs();
      return job;
    });
  }

  async function handleImproveJob(jobId = activeJobId) {
    if (!jobId) { setStatus("No job selected."); return; }
    await runAction("Relaunching professional improvement...", async () => {
      const job = await improveAutonomousJob(jobId);
      setActiveJobId(job.id);
      setActiveTab("overview");
      await refreshJobs();
      await refreshJobFiles(job.id);
      await refreshJobLogs(job.id);
      await refreshProjectReport(job.id);
      return job;
    });
  }

  async function handleResumeJob() {
    if (!activeJobId) { setStatus("No active job selected."); return; }
    await runAction("Resuming job...", async () => {
      const job = await resumeAutonomousJob(activeJobId);
      await refreshJobs();
      await refreshJobLogs(activeJobId);
      return job;
    });
  }

  async function handleExportGitHub() {
    if (!githubRepo.trim()) { setStatus("Missing GitHub repo. Example: owner/repo"); return; }
    if (!files.length) { setStatus("No files to export."); return; }
    await runAction("Exporting current files to GitHub...", async () => exportToGitHub({ repo: githubRepo.trim(), branch: githubBranch.trim() || "main", commitMessage: "AutoApp manual export", files }));
  }

  async function handleExportZip() {
    if (!files.length) { setStatus("No files to export."); return; }
    await runAction("Exporting ZIP...", async () => { await exportFilesAsZip(files, "autoapp-project"); return { ok: true, exported: files.length, format: "zip" }; });
  }

  async function handleGitHubAccessTest() {
    if (!githubRepo.trim()) { setStatus("Missing GitHub repo."); return; }
    await runAction("Testing GitHub access...", async () => testGitHubAccess({ repo: githubRepo.trim(), branch: githubBranch.trim() || "main" }));
  }

  async function handleGitHubWriteTest() {
    if (!githubRepo.trim()) { setStatus("Missing GitHub repo."); return; }
    await runAction("Writing real test file to GitHub...", async () => testGitHubExport({ repo: githubRepo.trim(), branch: githubBranch.trim() || "main" }));
  }

  async function handleLatestCommit() {
    if (!githubRepo.trim()) { setStatus("Missing GitHub repo."); return; }
    await runAction("Checking latest GitHub commit...", async () => getLatestGitHubCommit({ repo: githubRepo.trim(), branch: githubBranch.trim() || "main" }));
  }

  async function handleCheckTestFile() {
    if (!githubRepo.trim()) { setStatus("Missing GitHub repo."); return; }
    await runAction("Checking .autoapp-test.json...", async () => getGitHubFileStatus({ repo: githubRepo.trim(), branch: githubBranch.trim() || "main", path: ".autoapp-test.json" }));
  }

  async function handleDiagnostics() {
    await runAction("Running diagnostics...", async () => { const data = await getDiagnostics(); setDiagnostics(data); return data; });
  }

  async function handleLiveDiagnostics() {
    await runAction("Running live diagnostics...", async () => { const data = await getLiveDiagnostics(); setDiagnostics(data); return data; });
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
        if (data.files) { setFiles(data.files); setSelectedPath(data.files[0]?.path || ""); }
        return data;
      }
      if (action === "Deployment Pack") {
        const extra = await createDeploymentPack(files);
        const nextFiles = mergeFiles(files, extra);
        setFiles(nextFiles); setSelectedPath(nextFiles[0]?.path || ""); return extra;
      }
      if (action === "Publish Report") return createPublishReport(files);
      return null;
    });
  }


  async function handlePipelinePlan() {
    await runAction("Creating professional plan...", async () => {
      const data = await createPipelinePlan({
        prompt,
        files,
      });

      setPipelineResult(data);

      return data;
    });
  }

  async function handlePipelineQuality() {
    if (!files.length) {
      setStatus("No files loaded for quality check.");
      return;
    }

    await runAction("Running professional quality gate...", async () => {
      const data = await runPipelineQuality(files);

      setPipelineResult(data);

      return data;
    });
  }

  async function handlePipelineAutofix() {
    if (!files.length) {
      setStatus("No files loaded for autofix.");
      return;
    }

    await runAction("Applying professional autofix...", async () => {
      const data = await runPipelineAutofix({
        files,
        includeTests: false,
      });

      if (Array.isArray(data.files)) {
        setFiles(data.files);
        setSelectedPath(data.files[0]?.path || "");
      }

      setPipelineResult(data);

      return data;
    });
  }

  async function handleLoadTemplates() { await runAction("Loading templates...", async () => listTemplates()); }

  async function handleApplyTemplate(id: string) {
    await runAction("Applying template...", async () => {
      const template = await applyTemplate(id);
      const templateFiles = Array.isArray(template?.files) ? template.files : [];
      setFiles(templateFiles);
      setSelectedPath(templateFiles[0]?.path || "");
      return template || { ok: false, error: "Template returned null." };
    });
  }

  function handleCreateFile() { setFileActionValue("/src/new-file.ts"); setFileActionMode("create"); }
  function handleRenameSelectedFile() { if (!selectedFile) { setStatus("No file selected."); return; } setFileActionValue(selectedFile.path); setFileActionMode("rename"); }
  function handleDeleteSelectedFile() { if (!selectedFile) { setStatus("No file selected."); return; } setConfirmDeleteFilePath(selectedFile.path); }
  function handleCancelDeleteFile() { setConfirmDeleteFilePath(""); }

  function handleConfirmDeleteSelectedFile() {
    if (!confirmDeleteFilePath) return;
    const nextFiles = files.filter((file) => file.path !== confirmDeleteFilePath);
    setFiles(nextFiles);
    setSelectedPath(nextFiles[0]?.path || "");
    setStatus(`File deleted: ${confirmDeleteFilePath}`);
    setConfirmDeleteFilePath("");
  }

  function handleCancelFileAction() { setFileActionMode(null); setFileActionValue(""); }

  function handleConfirmFileAction() {
    const normalized = normalizePath(fileActionValue);
    if (!fileActionMode || !normalized.trim()) { handleCancelFileAction(); return; }
    if (fileActionMode === "create") {
      if (files.some((file) => normalizePath(file.path) === normalized)) { setStatus("File already exists."); return; }
      const nextFiles = [...files, { path: normalized, content: "" }].sort((a, b) => a.path.localeCompare(b.path));
      setFiles(nextFiles); setSelectedPath(normalized); setStatus(`File created: ${normalized}`); handleCancelFileAction(); return;
    }
    if (fileActionMode === "rename") {
      if (!selectedFile) { setStatus("No file selected."); handleCancelFileAction(); return; }
      if (files.some((file) => file.path !== selectedFile.path && normalizePath(file.path) === normalized)) { setStatus("A file already exists with this path."); return; }
      const nextFiles = files.map((file) => file.path === selectedFile.path ? { ...file, path: normalized } : file).sort((a, b) => a.path.localeCompare(b.path));
      setFiles(nextFiles); setSelectedPath(normalized); setStatus(`File renamed: ${normalized}`); handleCancelFileAction();
    }
  }

  useEffect(() => { refreshJobs().catch(() => undefined); }, []);
  useEffect(() => {
    if (!autoRefreshJobs) return;
    const timer = window.setInterval(() => {
      refreshJobs().catch(() => undefined);
      if (activeJobId) { refreshJobLogs(activeJobId).catch(() => undefined); refreshProjectReport(activeJobId).catch(() => undefined); }
    }, 15000);
    return () => window.clearInterval(timer);
  }, [autoRefreshJobs, activeJobId]);

  return {
    prompt, setPrompt,
    files, setFiles,
    selectedPath, setSelectedPath, selectedFile,
    activeJobId, setActiveJobId, activeJob,
    jobs, jobLogs, githubHistory, projectReport,
    refreshJobs, refreshJobFiles, refreshJobLogs, refreshProjectReport,
    handleLoadJobLogs, handleLoadGitHubHistory, handleOpenProject, handleDeleteProject,
    githubRepo, setGithubRepo, githubBranch, setGithubBranch,
    autoRefreshJobs, setAutoRefreshJobs,
    snapshots, handleSaveSnapshot, handleRestoreSnapshot, handleDeleteSnapshot,
    fileActionMode, setFileActionMode, fileActionValue, setFileActionValue,
    handleCancelFileAction, handleConfirmFileAction,
    confirmDeleteFilePath, setConfirmDeleteFilePath, handleCancelDeleteFile, handleConfirmDeleteSelectedFile,
    busy, status, result, diagnostics, pipelineResult, projectStats, activeTab, setActiveTab,
    notifications, dismissNotification, activityEvents, clearActivityEvents,
    sessionSnapshotAvailable, restoreFrontendSnapshot, dismissFrontendSnapshot,
    buildPromptWithGitHubTarget, runAction,
    handleGenerate, handleStartAutonomous, handleStepJob, handleImproveJob, handleResumeJob,
    handleExportGitHub, handleExportZip, handleGitHubAccessTest, handleGitHubWriteTest,
    handleLatestCommit, handleCheckTestFile, handleDiagnostics, handleLiveDiagnostics,
    handlePipelinePlan, handlePipelineQuality, handlePipelineAutofix,
    handleUtility, handleLoadTemplates, handleApplyTemplate,
    handleCreateFile, handleDeleteSelectedFile, handleRenameSelectedFile,
  };
}

function mergeFiles(currentFiles: VirtualFile[], changedFiles: VirtualFile[]) {
  const map = new Map<string, VirtualFile>();
  for (const file of currentFiles || []) map.set(normalizePath(file.path), { path: normalizePath(file.path), content: file.content });
  for (const file of changedFiles || []) {
    const path = normalizePath(file.path);
    if (file.content === null) map.delete(path); else map.set(path, { path, content: file.content });
  }
  return Array.from(map.values()).sort((a, b) => a.path.localeCompare(b.path));
}

function normalizePath(path: string) {
  const value = String(path || "").trim();
  return value.startsWith("/") ? value : `/${value}`;
}

export type AutoAppState = ReturnType<typeof useAutoApp>;
