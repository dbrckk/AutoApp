import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";

import { ActionQueuePanel } from "./components/ActionQueuePanel";
import { AutopilotPanel } from "./components/AutopilotPanel";
import { BuildPanel } from "./components/BuildPanel";
import { CodeViewer } from "./components/CodeViewer";
import { DependencyPanel } from "./components/DependencyPanel";
import { DeploymentPanel } from "./components/DeploymentPanel";
import { FileEditorPanel } from "./components/FileEditorPanel";
import { FileTree } from "./components/FileTree";
import { InspectionPanel } from "./components/InspectionPanel";
import { JobPanel } from "./components/JobPanel";
import { PreviewPanel } from "./components/PreviewPanel";
import { PublishPanel } from "./components/PublishPanel";
import { RealPreviewPanel } from "./components/RealPreviewPanel";
import { ScorePanel } from "./components/ScorePanel";
import { TemplatesPanel } from "./components/TemplatesPanel";

import {
  checkBuild,
  createDeploymentPack,
  createPublishReport,
  generateProject,
  getJob,
  getPreview,
  inspectProject,
  resolveDependencies,
  startGenerationJob,
  startPreview,
  stopPreview,
  type AiConfig,
  type BuildMode,
} from "./lib/api";

import { downloadZip } from "./lib/zip";
import type { GenerationResponse, Project, VirtualFile } from "./types";

const STORAGE_KEY = "forge.projects.v2";

function uid() {
  return crypto.randomUUID();
}

function now() {
  return Date.now();
}

function normalizePath(path: string) {
  if (!path) return "/";
  return path.startsWith("/") ? path : `/${path}`;
}

function mergeFiles(currentFiles: VirtualFile[], generatedFiles: VirtualFile[]) {
  const map = new Map<string, VirtualFile>();

  for (const file of currentFiles || []) {
    map.set(normalizePath(file.path), {
      path: normalizePath(file.path),
      content: file.content,
    });
  }

  for (const file of generatedFiles || []) {
    const path = normalizePath(file.path);

    if (file.content === null) {
      map.delete(path);
      continue;
    }

    map.set(path, {
      path,
      content: file.content,
    });
  }

  return Array.from(map.values()).sort((a, b) => a.path.localeCompare(b.path));
}

function createEmptyProject(prompt = ""): Project {
  return {
    id: uid(),
    name: prompt.trim().slice(0, 42) || "Untitled App",
    prompt,
    files: [],
    commits: [],
    createdAt: now(),
    updatedAt: now(),
    nextActions: [],
  };
}

function safeLoadProjects(): Project[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function safeSaveProjects(projects: Project[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

export default function App() {
  const [projects, setProjects] = useState<Project[]>(() => safeLoadProjects());
  const [activeProjectId, setActiveProjectId] = useState<string>(() => {
    const loaded = safeLoadProjects();
    return loaded[0]?.id || "";
  });

  const [prompt, setPrompt] = useState("");
  const [selectedPath, setSelectedPath] = useState("");
  const [newFilePath, setNewFilePath] = useState("");

  const [isGenerating, setIsGenerating] = useState(false);
  const [isAutoImprove, setIsAutoImprove] = useState(false);
  const [buildMode, setBuildMode] = useState<BuildMode>("virtual");
  const [buildResult, setBuildResult] = useState<any>(null);
  const [isCheckingBuild, setIsCheckingBuild] = useState(false);

  const [error, setError] = useState("");
  const [lastResponse, setLastResponse] = useState<GenerationResponse | null>(null);

  const [inspection, setInspection] = useState<any>(null);
  const [isInspecting, setIsInspecting] = useState(false);

  const [dependencyResolution, setDependencyResolution] = useState<any>(null);
  const [isResolvingDependencies, setIsResolvingDependencies] = useState(false);

  const [isCreatingDeploymentPack, setIsCreatingDeploymentPack] = useState(false);

  const [publishReport, setPublishReport] = useState<any>(null);
  const [isCreatingPublishReport, setIsCreatingPublishReport] = useState(false);

  const [generationJob, setGenerationJob] = useState<any>(null);
  const [activeJobId, setActiveJobId] = useState("");

  const [previewSession, setPreviewSession] = useState<any>(null);
  const [isStartingPreview, setIsStartingPreview] = useState(false);

  const [isAutopilotRunning, setIsAutopilotRunning] = useState(false);
  const [autopilotStopRequested, setAutopilotStopRequested] = useState(false);
  const [autopilotTargetScore, setAutopilotTargetScore] = useState(90);
  const [autopilotMaxIterations, setAutopilotMaxIterations] = useState(5);
  const [autopilotLogs, setAutopilotLogs] = useState<string[]>([]);

  const [aiConfig, setAiConfig] = useState<AiConfig>(() => ({
    provider: localStorage.getItem("forge.ai.provider") || "gemini",
    apiKey: localStorage.getItem("forge.ai.apiKey") || "",
    baseUrl: localStorage.getItem("forge.ai.baseUrl") || "",
    model: localStorage.getItem("forge.ai.model") || "",
  }));

  const activeProject = useMemo(
    () => projects.find((project) => project.id === activeProjectId) || projects[0],
    [projects, activeProjectId]
  );

  const selectedFile = useMemo(() => {
    if (!activeProject) return undefined;

    return activeProject.files.find(
      (file) => normalizePath(file.path) === normalizePath(selectedPath)
    );
  }, [activeProject, selectedPath]);

useEffect(() => {
    safeSaveProjects(projects);
  }, [projects]);

  useEffect(() => {
    if (!activeProject && projects.length > 0) {
      setActiveProjectId(projects[0].id);
    }
  }, [activeProject, projects]);

  useEffect(() => {
    localStorage.setItem("forge.ai.provider", aiConfig.provider || "");
    localStorage.setItem("forge.ai.apiKey", aiConfig.apiKey || "");
    localStorage.setItem("forge.ai.baseUrl", aiConfig.baseUrl || "");
    localStorage.setItem("forge.ai.model", aiConfig.model || "");
  }, [aiConfig]);

  useEffect(() => {
    if (!selectedPath && activeProject?.files?.length) {
      setSelectedPath(activeProject.files[0].path);
    }
  }, [activeProject, selectedPath]);

  useEffect(() => {
    if (!activeJobId) return;

    let alive = true;

    const timer = window.setInterval(async () => {
      try {
        const job = await getJob(activeJobId);
        if (!alive) return;

        setGenerationJob(job);

        if (job.status === "success" && job.result) {
          const baseProject = activeProject || createEmptyProject(prompt);
          const response = job.result as GenerationResponse;
          const merged = mergeFiles(baseProject.files || [], response.files || []);

          updateProject({
            ...baseProject,
            prompt,
            files: merged,
            updatedAt: now(),
            score: response.score,
            nextActions: response.nextActions || [],
            commits: [
              {
                id: uid(),
                message: response.changelog || "AI generation job",
                timestamp: now(),
                files: response.files || [],
                score: response.score,
              },
              ...(baseProject.commits || []),
            ],
          });

          setLastResponse(response);
          setSelectedPath(response.files?.[0]?.path || merged[0]?.path || "");
          setIsGenerating(false);
          setActiveJobId("");
        }

        if (job.status === "error") {
          setError(job.error || "Generation job failed.");
          setIsGenerating(false);
          setActiveJobId("");
        }
      } catch (err: any) {
        setError(err?.message || "Job polling failed.");
        setIsGenerating(false);
        setActiveJobId("");
      }
    }, 1500);

    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [activeJobId, activeProject, prompt]);

  useEffect(() => {
    if (!previewSession?.id) return;
    if (previewSession.status === "stopped") return;
    if (previewSession.status === "error") return;

    let alive = true;

    const timer = window.setInterval(async () => {
      try {
        const session = await getPreview(previewSession.id);
        if (alive) setPreviewSession(session);
      } catch {
        // Ignore temporary preview polling errors.
      }
    }, 1500);

    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [previewSession?.id, previewSession?.status]);

  function updateProject(project: Project) {
    setProjects((prev) => {
      const exists = prev.some((p) => p.id === project.id);
      if (!exists) return [project, ...prev];
      return prev.map((p) => (p.id === project.id ? project : p));
    });

    setActiveProjectId(project.id);
  }

  function renameProject(name: string) {
    if (!activeProject) return;

    updateProject({
      ...activeProject,
      name: name.trim() || "Untitled App",
      updatedAt: now(),
    });
  }

  function duplicateProject() {
    if (!activeProject) return;

    const copy: Project = {
      ...activeProject,
      id: uid(),
      name: `${activeProject.name} Copy`,
      createdAt: now(),
      updatedAt: now(),
    };

    updateProject(copy);
  }

  function restoreCommit(commitId: string) {
    if (!activeProject) return;

    const commit = activeProject.commits.find((item) => item.id === commitId);
    if (!commit) return;

    const restoredFiles = mergeFiles(activeProject.files, commit.files);

    updateProject({
      ...activeProject,
      files: restoredFiles,
      updatedAt: now(),
      commits: [
        {
          id: uid(),
          message: `Restored commit: ${commit.message}`,
          timestamp: now(),
          files: commit.files,
          score: commit.score,
        },
        ...activeProject.commits,
      ],
    });

    setSelectedPath(restoredFiles[0]?.path || "");
    setBuildResult(null);
  }

  function compactHistory() {
    if (!activeProject) return;

    updateProject({
      ...activeProject,
      commits: activeProject.commits.slice(0, 20),
      updatedAt: now(),
    });
  }

  async function handleGenerate(customPrompt?: string, auto = false) {
    const finalPrompt = (customPrompt || prompt).trim();

    if (!finalPrompt) {
      setError("Prompt required.");
      return;
    }

    setError("");
    setIsGenerating(true);
    setLastResponse(null);
    setBuildResult(null);

    try {
      const baseProject = activeProject || createEmptyProject(finalPrompt);

      const response = await generateProject({
        prompt: finalPrompt,
        currentFiles: baseProject.files || [],
        isAutoImprove: auto,
        aiConfig,
        buildMode,
      });

      const merged = mergeFiles(baseProject.files || [], response.files || []);

      const updatedProject: Project = {
        ...baseProject,
        name: baseProject.name || finalPrompt.slice(0, 42) || "Generated App",
        prompt: finalPrompt,
        files: merged,
        updatedAt: now(),
        score: response.score,
        nextActions: response.nextActions || [],
        commits: [
          {
            id: uid(),
            message: response.changelog || "AI generation",
            timestamp: now(),
            files: response.files || [],
            score: response.score,
          },
          ...(baseProject.commits || []),
        ],
      };

      updateProject(updatedProject);
      setLastResponse(response);
      setSelectedPath(response.files?.[0]?.path || merged[0]?.path || "");
    } catch (err: any) {
      setError(err?.message || "Generation failed.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleGenerateJob(customPrompt?: string, auto = false) {
    const finalPrompt = (customPrompt || prompt).trim();

    if (!finalPrompt) {
      setError("Prompt required.");
      return;
    }

    setError("");
    setIsGenerating(true);
    setLastResponse(null);
    setBuildResult(null);
    setGenerationJob(null);

    try {
      const baseProject = activeProject || createEmptyProject(finalPrompt);

      const jobId = await startGenerationJob({
        prompt: finalPrompt,
        currentFiles: baseProject.files || [],
        isAutoImprove: auto,
        aiConfig,
        buildMode,
      });

      setActiveJobId(jobId);
    } catch (err: any) {
      setError(err?.message || "Generation job failed.");
      setIsGenerating(false);
    }
  }

  async function handleAutoImprove() {
    if (!activeProject) {
      setError("Create a project first.");
      return;
    }

    setIsAutoImprove(true);

    try {
      const tasks = activeProject.nextActions?.length
        ? activeProject.nextActions
            .map((action, index) => `${index + 1}. ${action}`)
            .join("\n")
        : "Improve architecture, UI, mobile UX, SEO, accessibility, reliability, monetization, error states, performance and production readiness.";

      await handleGenerateJob(
        [
          "You are improving the current project to make it publish-ready.",
          "",
          "Priority tasks:",
          tasks,
          "",
          "Hard requirements:",
          "- preserve all existing features",
          "- return complete changed files only",
          "- fix weak structure",
          "- improve mobile-first UX",
          "- improve SEO and accessibility",
          "- improve error handling",
          "- keep dependencies consistent",
          "- keep the app buildable",
          "- remove placeholders when possible",
        ].join("\n"),
        true
      );
    } finally {
      setIsAutoImprove(false);
    }
    }

async function handleBuildCheck(mode: BuildMode) {
    if (!activeProject) return;

    setIsCheckingBuild(true);
    setBuildResult(null);

    try {
      const result = await checkBuild({
        files: activeProject.files,
        mode,
      });

      setBuildResult(result);
    } catch (err: any) {
      setBuildResult({
        ok: false,
        issues: [],
        log: err?.message || "Build check failed.",
      });
    } finally {
      setIsCheckingBuild(false);
    }
  }

  async function handleInspectProject() {
    if (!activeProject) return;

    setIsInspecting(true);

    try {
      const result = await inspectProject(activeProject.files);
      setInspection(result);
    } catch (err: any) {
      setInspection({
        framework: "Unknown",
        language: "Unknown",
        packageManager: "npm",
        entrypoints: [],
        dependencies: [],
        devDependencies: [],
        missingCriticalFiles: [],
        risks: [err?.message || "Inspection failed."],
        strengths: [],
      });
    } finally {
      setIsInspecting(false);
    }
  }

  async function handleAnalyzeDependencies() {
    if (!activeProject) return;

    setIsResolvingDependencies(true);

    try {
      const result = await resolveDependencies({
        files: activeProject.files,
        apply: false,
      });

      setDependencyResolution(result.resolution);
    } catch (err: any) {
      setDependencyResolution({
        ok: false,
        missingDependencies: [],
        warnings: [err?.message || "Dependency analysis failed."],
      });
    } finally {
      setIsResolvingDependencies(false);
    }
  }

  async function handleApplyDependencyFix() {
    if (!activeProject) return;

    setIsResolvingDependencies(true);

    try {
      const result = await resolveDependencies({
        files: activeProject.files,
        apply: true,
      });

      if (result.files) {
        updateProject({
          ...activeProject,
          files: result.files,
          updatedAt: now(),
          commits: [
            {
              id: uid(),
              message: "Dependency resolver updated package.json",
              timestamp: now(),
              files: result.files.filter(
                (file: VirtualFile) => normalizePath(file.path) === "/package.json"
              ),
              score: activeProject.score,
            },
            ...activeProject.commits,
          ],
        });
      }

      setDependencyResolution(result.resolution);
      setBuildResult(null);
    } catch (err: any) {
      setDependencyResolution({
        ok: false,
        missingDependencies: [],
        warnings: [err?.message || "Dependency fix failed."],
      });
    } finally {
      setIsResolvingDependencies(false);
    }
  }

  async function handleCreateDeploymentPack() {
    if (!activeProject) return;

    setIsCreatingDeploymentPack(true);

    try {
      const files = await createDeploymentPack(activeProject.files);
      const merged = mergeFiles(activeProject.files, files);

      updateProject({
        ...activeProject,
        files: merged,
        updatedAt: now(),
        commits: [
          {
            id: uid(),
            message: "Added deployment pack",
            timestamp: now(),
            files,
            score: activeProject.score,
          },
          ...activeProject.commits,
        ],
      });

      setSelectedPath(files[0]?.path || selectedPath);
      setBuildResult(null);
    } finally {
      setIsCreatingDeploymentPack(false);
    }
  }

  async function handleCreatePublishReport() {
    if (!activeProject) return;

    setIsCreatingPublishReport(true);

    try {
      const report = await createPublishReport(activeProject.files);
      setPublishReport(report);
    } catch (err: any) {
      setPublishReport({
        ready: false,
        score: 0,
        blockers: [err?.message || "Publish report failed."],
        warnings: [],
        checklist: [],
        commands: [],
      });
    } finally {
      setIsCreatingPublishReport(false);
    }
  }

  async function handleStartPreview() {
    if (!activeProject?.files?.length) return;

    setIsStartingPreview(true);

    try {
      if (previewSession?.id) {
        await stopPreview(previewSession.id);
      }

      const session = await startPreview(activeProject.files);
      setPreviewSession(session);
    } catch (err: any) {
      setPreviewSession({
        status: "error",
        error: err?.message || "Preview failed.",
        logs: [],
      });
    } finally {
      setIsStartingPreview(false);
    }
  }

  async function handleStopPreview() {
    if (!previewSession?.id) return;

    const session = await stopPreview(previewSession.id);
    setPreviewSession(session);
  }

  function saveFile(path: string, content: string) {
    if (!activeProject) return;

    const normalized = normalizePath(path);

    const updatedFiles = mergeFiles(activeProject.files, [
      {
        path: normalized,
        content,
      },
    ]);

    updateProject({
      ...activeProject,
      files: updatedFiles,
      updatedAt: now(),
      commits: [
        {
          id: uid(),
          message: `Manual edit: ${normalized}`,
          timestamp: now(),
          files: [{ path: normalized, content }],
          score: activeProject.score,
        },
        ...activeProject.commits,
      ],
    });

    setSelectedPath(normalized);
    setBuildResult(null);
  }

  function deleteFile(path: string) {
    if (!activeProject) return;

    const normalized = normalizePath(path);

    const updatedFiles = mergeFiles(activeProject.files, [
      {
        path: normalized,
        content: null,
      },
    ]);

    updateProject({
      ...activeProject,
      files: updatedFiles,
      updatedAt: now(),
      commits: [
        {
          id: uid(),
          message: `Deleted file: ${normalized}`,
          timestamp: now(),
          files: [{ path: normalized, content: null }],
          score: activeProject.score,
        },
        ...activeProject.commits,
      ],
    });

    setSelectedPath(updatedFiles[0]?.path || "");
    setBuildResult(null);
  }

  function createFile() {
    if (!activeProject) return;

    const normalized = normalizePath(newFilePath.trim());
    if (!normalized || normalized === "/") return;

    saveFile(normalized, "");
    setNewFilePath("");
  }

  function handleNewProject() {
    const project = createEmptyProject("");

    updateProject(project);
    setPrompt("");
    setSelectedPath("");
    setNewFilePath("");
    setBuildResult(null);
    setLastResponse(null);
    setInspection(null);
    setDependencyResolution(null);
    setPublishReport(null);
    setError("");
  }

  function handleDeleteProject(id: string) {
    setProjects((prev) => prev.filter((project) => project.id !== id));

    if (activeProjectId === id) {
      const nextProject = projects.find((project) => project.id !== id);
      setActiveProjectId(nextProject?.id || "");
      setSelectedPath("");
    }
  }

  function handleApplyTemplate(template: any) {
    const project: Project = {
      id: uid(),
      name: template.name,
      prompt: template.prompt,
      files: template.files,
      commits: [
        {
          id: uid(),
          message: `Applied template: ${template.name}`,
          timestamp: now(),
          files: template.files,
        },
      ],
      createdAt: now(),
      updatedAt: now(),
      nextActions: [],
    };

    updateProject(project);
    setPrompt(template.prompt);
    setSelectedPath(template.files[0]?.path || "");
    setBuildResult(null);
    setLastResponse(null);
    setInspection(null);
    setDependencyResolution(null);
    setPublishReport(null);
  }

  async function handleExportZip() {
    if (!activeProject) return;
    await downloadZip(activeProject.files, activeProject.name || "forge-project");
  }

  function copySelectedFile() {
    if (!selectedFile?.content) return;
    navigator.clipboard.writeText(selectedFile.content);
  }

  async function runAction(action: string) {
    if (!activeProject) return;

    await handleGenerateJob(
      [
        "Apply this improvement task to the current project:",
        action,
        "",
        "Rules:",
        "- preserve existing features",
        "- return complete changed files only",
        "- improve production readiness",
        "- keep the app buildable",
      ].join("\n"),
      true
    );
  }

  async function runAllActions() {
    if (!activeProject?.nextActions?.length) return;

    await handleGenerateJob(
      [
        "Apply all these improvement tasks to the current project:",
        ...activeProject.nextActions.map((action, index) => `${index + 1}. ${action}`),
        "",
        "Rules:",
        "- preserve existing features",
        "- return complete changed files only",
        "- improve production readiness",
        "- keep the app buildable",
        "- prioritize high-impact fixes first",
      ].join("\n"),
      true
    );
  }

  function pushAutopilotLog(message: string) {
    setAutopilotLogs((prev) =>
      [`${new Date().toLocaleTimeString()} · ${message}`, ...prev].slice(0, 50)
    );
  }

  async function runAutopilot() {
    if (!activeProject) {
      setError("Create a project first.");
      return;
    }

    setIsAutopilotRunning(true);
    setAutopilotStopRequested(false);
    setAutopilotLogs([]);

    let currentProject = activeProject;

    try {
      for (let iteration = 1; iteration <= autopilotMaxIterations; iteration++) {
        if (autopilotStopRequested) {
          pushAutopilotLog("Stopped by user.");
          break;
        }

        const currentScore = currentProject.score?.total || 0;

        if (currentScore >= autopilotTargetScore) {
          pushAutopilotLog(`Target reached: ${currentScore}/${autopilotTargetScore}.`);
          break;
        }

        pushAutopilotLog(
          `Iteration ${iteration}/${autopilotMaxIterations} started. Current score: ${currentScore}.`
        );

        const tasks = currentProject.nextActions?.length
          ? currentProject.nextActions
              .map((action, index) => `${index + 1}. ${action}`)
              .join("\n")
          : "Improve UI, architecture, SEO, accessibility, reliability, mobile UX, performance and monetization.";

        const response = await generateProject({
          prompt: [
            "Autopilot improvement iteration.",
            "",
            `Current score: ${currentScore}`,
            `Target score: ${autopilotTargetScore}`,
            "",
            "Tasks:",
            tasks,
            "",
            "Rules:",
            "- preserve existing features",
            "- fix build issues",
            "- improve the lowest-scoring categories first",
            "- return complete changed files only",
            "- keep the project production-ready",
          ].join("\n"),
          currentFiles: currentProject.files,
          isAutoImprove: true,
          aiConfig,
          buildMode,
        });

        const merged = mergeFiles(currentProject.files, response.files || []);

        const updatedProject: Project = {
          ...currentProject,
          files: merged,
          updatedAt: now(),
          score: response.score,
          nextActions: response.nextActions || [],
          commits: [
            {
              id: uid(),
              message: `Autopilot iteration ${iteration}: ${
                response.changelog || "Improved project"
              }`,
              timestamp: now(),
              files: response.files || [],
              score: response.score,
            },
            ...currentProject.commits,
          ],
        };

        currentProject = updatedProject;
        updateProject(updatedProject);
        setLastResponse(response);

        pushAutopilotLog(
          `Iteration ${iteration} complete. New score: ${response.score?.total ?? "unknown"}.`
        );

        if ((response.score?.total || 0) >= autopilotTargetScore) {
          pushAutopilotLog(`Target reached: ${response.score?.total}/${autopilotTargetScore}.`);
          break;
        }
      }
    } catch (err: any) {
      pushAutopilotLog(err?.message || "Autopilot failed.");
      setError(err?.message || "Autopilot failed.");
    } finally {
      setIsAutopilotRunning(false);
    }
  }

  function stopAutopilot() {
    setAutopilotStopRequested(true);
    pushAutopilotLog("Stop requested.");
          }

return (
    <div className="min-h-screen bg-[#050505] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.10),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.08),transparent_28%)]" />

      <div className="relative mx-auto flex min-h-screen max-w-[1700px] flex-col p-4 lg:p-6">
        <header className="mb-4 flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">Forge</p>

            <h1 className="text-2xl font-black tracking-tight text-white md:text-4xl">
              AI App Builder
            </h1>

            <p className="mt-1 max-w-2xl text-sm text-zinc-400">
              Generate, improve, score, repair, preview, edit and export production-ready app projects.
            </p>

            {activeProject && (
              <input
                value={activeProject.name}
                onChange={(event) => renameProject(event.target.value)}
                className="mt-3 w-full max-w-md rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-sm font-bold text-white outline-none"
              />
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleNewProject}
              className="rounded-2xl border border-white/10 px-4 py-2 text-xs font-bold text-white hover:bg-white/10"
            >
              New project
            </button>

            <button
              onClick={duplicateProject}
              disabled={!activeProject}
              className="rounded-2xl border border-white/10 px-4 py-2 text-xs font-bold text-white hover:bg-white/10 disabled:opacity-40"
            >
              Duplicate
            </button>

            <button
              onClick={handleExportZip}
              disabled={!activeProject?.files?.length}
              className="rounded-2xl bg-white px-4 py-2 text-xs font-bold text-black disabled:opacity-40"
            >
              Export ZIP
            </button>
          </div>
        </header>

        <main className="grid flex-1 gap-4 lg:grid-cols-[290px_minmax(0,1fr)_400px]">
          <aside className="space-y-4">
            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Projects</h2>
                <span className="text-xs text-zinc-500">{projects.length}</span>
              </div>

              <div className="space-y-2">
                {projects.length === 0 && (
                  <p className="rounded-2xl border border-dashed border-white/10 p-4 text-xs text-zinc-500">
                    No project yet.
                  </p>
                )}

                {projects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => {
                      setActiveProjectId(project.id);
                      setSelectedPath(project.files[0]?.path || "");
                      setBuildResult(null);
                      setLastResponse(null);
                      setInspection(null);
                      setDependencyResolution(null);
                      setPublishReport(null);
                    }}
                    className={`w-full rounded-2xl border p-3 text-left transition ${
                      activeProject?.id === project.id
                        ? "border-white/30 bg-white/10"
                        : "border-white/10 bg-black/20 hover:bg-white/5"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">{project.name}</p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {project.files.length} files · {project.score?.total ?? "—"} score
                        </p>
                      </div>

                      <span
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDeleteProject(project.id);
                        }}
                        className="rounded-lg px-2 py-1 text-xs text-zinc-500 hover:bg-red-500/10 hover:text-red-300"
                      >
                        ×
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <TemplatesPanel onApply={handleApplyTemplate} />

            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl">
              <h2 className="mb-3 text-sm font-semibold">Files</h2>

              {activeProject?.files?.length ? (
                <FileTree
                  files={activeProject.files}
                  selectedPath={selectedPath}
                  onSelect={setSelectedPath}
                />
              ) : (
                <p className="rounded-2xl border border-dashed border-white/10 p-4 text-xs text-zinc-500">
                  Generated files will appear here.
                </p>
              )}

              <div className="mt-4 flex gap-2">
                <input
                  value={newFilePath}
                  onChange={(event) => setNewFilePath(event.target.value)}
                  placeholder="/src/new-file.ts"
                  className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white outline-none placeholder:text-zinc-600"
                />

                <button
                  onClick={createFile}
                  disabled={!activeProject}
                  className="rounded-2xl bg-white px-3 py-2 text-xs font-bold text-black disabled:opacity-40"
                >
                  Add
                </button>
              </div>
            </section>
          </aside>

          <section className="flex min-w-0 flex-col gap-4">
            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl">
              <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-sm font-semibold">Prompt</h2>
                  <p className="text-xs text-zinc-500">
                    Describe the app or the improvement you want.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {(["none", "virtual", "real"] as BuildMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setBuildMode(mode)}
                      className={`rounded-2xl px-4 py-2 text-xs font-bold capitalize ${
                        buildMode === mode
                          ? "bg-white text-black"
                          : "border border-white/10 text-zinc-300 hover:bg-white/10"
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Create a premium mobile-first SaaS dashboard with onboarding, pricing, analytics, auth screens, SEO and clean component architecture..."
                className="min-h-36 w-full resize-none rounded-3xl border border-white/10 bg-black/40 p-4 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-white/30"
              />

              {error && (
                <div className="mt-3 rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">
                  {error}
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => handleGenerateJob()}
                  disabled={isGenerating}
                  className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-black disabled:opacity-50"
                >
                  {isGenerating ? "Generating..." : "Generate / Improve"}
                </button>

                <button
                  onClick={handleAutoImprove}
                  disabled={isGenerating || !activeProject?.files?.length}
                  className="rounded-2xl border border-white/15 px-5 py-3 text-sm font-bold text-white hover:bg-white/10 disabled:opacity-50"
                >
                  {isAutoImprove ? "Improving..." : "Auto Improve"}
                </button>
              </div>
            </section>

            <JobPanel job={generationJob} />

            <PreviewPanel files={activeProject?.files || []} />

            <RealPreviewPanel
              session={previewSession}
              loading={isStartingPreview}
              onStart={handleStartPreview}
              onStop={handleStopPreview}
            />

            <section className="min-h-[560px] overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {selectedFile?.path || "No file selected"}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {selectedFile?.content?.length
                      ? `${selectedFile.content.length.toLocaleString()} characters`
                      : "Select a generated file"}
                  </p>
                </div>

                <button
                  onClick={copySelectedFile}
                  disabled={!selectedFile?.content}
                  className="rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-zinc-300 hover:bg-white/10 disabled:opacity-40"
                >
                  Copy
                </button>
              </div>

              <div className="h-[620px] overflow-auto">
                {selectedFile ? (
                  <CodeViewer file={selectedFile} />
                ) : (
                  <div className="flex h-full items-center justify-center p-8 text-center text-sm text-zinc-500">
                    Generate a project to inspect files.
                  </div>
                )}
              </div>
            </section>

            <FileEditorPanel
              file={selectedFile}
              onSave={saveFile}
              onDelete={deleteFile}
            />
          </section>

          <aside className="space-y-4">
            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl">
              <h2 className="mb-3 text-sm font-semibold">AI Provider</h2>

              <div className="space-y-3">
                <label className="block">
                  <span className="mb-1 block text-xs text-zinc-500">Provider</span>

                  <select
                    value={aiConfig.provider || "gemini"}
                    onChange={(event) =>
                      setAiConfig((prev) => ({
                        ...prev,
                        provider: event.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none"
                  >
                    <option value="gemini">Gemini</option>
                    <option value="openai">OpenAI-compatible</option>
                    <option value="groq">Groq / custom</option>
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs text-zinc-500">Model</span>

                  <input
                    value={aiConfig.model || ""}
                    onChange={(event) =>
                      setAiConfig((prev) => ({
                        ...prev,
                        model: event.target.value,
                      }))
                    }
                    placeholder="gemini-2.5-flash / llama-3.3-70b-versatile"
                    className="w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none placeholder:text-zinc-700"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs text-zinc-500">API Key</span>

                  <input
                    type="password"
                    value={aiConfig.apiKey || ""}
                    onChange={(event) =>
                      setAiConfig((prev) => ({
                        ...prev,
                        apiKey: event.target.value,
                      }))
                    }
                    placeholder="Optional if server .env is configured"
                    className="w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none placeholder:text-zinc-700"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs text-zinc-500">Base URL</span>

                  <input
                    value={aiConfig.baseUrl || ""}
                    onChange={(event) =>
                      setAiConfig((prev) => ({
                        ...prev,
                        baseUrl: event.target.value,
                      }))
                    }
                    placeholder="https://api.groq.com/openai/v1"
                    className="w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none placeholder:text-zinc-700"
                  />
                </label>
              </div>
            </section>

            <ScorePanel
              score={activeProject?.score}
              nextActions={activeProject?.nextActions}
            />

            <ActionQueuePanel
              actions={activeProject?.nextActions || []}
              loading={isGenerating}
              onRunAction={runAction}
              onRunAll={runAllActions}
            />

            <AutopilotPanel
              running={isAutopilotRunning}
              targetScore={autopilotTargetScore}
              maxIterations={autopilotMaxIterations}
              logs={autopilotLogs}
              onTargetScoreChange={setAutopilotTargetScore}
              onMaxIterationsChange={setAutopilotMaxIterations}
              onStart={runAutopilot}
              onStop={stopAutopilot}
            />

            <BuildPanel
              result={buildResult}
              loading={isCheckingBuild}
              onCheckVirtual={() => handleBuildCheck("virtual")}
              onCheckReal={() => handleBuildCheck("real")}
            />

            <InspectionPanel
              inspection={inspection}
              loading={isInspecting}
              onInspect={handleInspectProject}
            />

            <DependencyPanel
              resolution={dependencyResolution}
              loading={isResolvingDependencies}
              onAnalyze={handleAnalyzeDependencies}
              onApply={handleApplyDependencyFix}
            />

            <DeploymentPanel
              loading={isCreatingDeploymentPack}
              onGenerate={handleCreateDeploymentPack}
            />

            <PublishPanel
              report={publishReport}
              loading={isCreatingPublishReport}
              onGenerate={handleCreatePublishReport}
            />

            {lastResponse && (
              <motion.section
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl"
              >
                <h2 className="mb-2 text-sm font-semibold">Last generation</h2>

                <p className="whitespace-pre-wrap text-xs leading-relaxed text-zinc-300">
                  {lastResponse.changelog}
                </p>

                <div className="mt-3 rounded-2xl bg-black/30 p-3 text-xs text-zinc-400">
                  Mode: {lastResponse.mode || "create"} · Saved:{" "}
                  {lastResponse.estimatedTimeSaved || "—"}
                </div>
              </motion.section>
            )}

            {activeProject?.commits?.length ? (
              <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold">History</h2>

                  <button
                    onClick={compactHistory}
                    className="rounded-xl border border-white/10 px-2 py-1 text-[11px] font-bold text-zinc-300 hover:bg-white/10"
                  >
                    Compact
                  </button>
                </div>

                <div className="max-h-80 space-y-2 overflow-auto">
                  {activeProject.commits.map((commit) => (
                    <div
                      key={commit.id}
                      className="rounded-2xl border border-white/10 bg-black/25 p-3"
                    >
                      <p className="line-clamp-3 text-xs text-zinc-300">
                        {commit.message}
                      </p>

                      <p className="mt-2 text-[11px] text-zinc-600">
                        {new Date(commit.timestamp).toLocaleString()} ·{" "}
                        {commit.files.length} changed files · score{" "}
                        {commit.score?.total ?? "—"}
                      </p>

                      <button
                        onClick={() => restoreCommit(commit.id)}
                        className="mt-2 rounded-xl bg-white px-3 py-1.5 text-[11px] font-bold text-black"
                      >
                        Restore
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </aside>
        </main>
      </div>
    </div>
  );
            }
