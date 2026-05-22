import { useEffect, useMemo, useRef, useState } from "react";

import { FileTree } from "./components/FileTree";
import { CodeEditor } from "./components/CodeEditor";
import { PreviewPanel } from "./components/PreviewPanel";
import { ScorePanel } from "./components/ScorePanel";
import { MemoryPanel } from "./components/MemoryPanel";
import { ProjectHealthPanel } from "./components/ProjectHealthPanel";

import {
  applyTemplate,
  checkBuild,
  createDeploymentPack,
  createPublishReport,
  generateProject,
  getJob,
  getPreview,
  getProjectMemory,
  inspectProject,
  listTemplates,
  resetProjectMemory,
  resolveDependencies,
  scoreProject,
  startAutopilotJob,
  startGenerationJob,
  startPreview,
  stopPreview,
  type AiConfig,
  type BuildMode,
} from "./lib/api";

import {
  exportProjectAsJson,
  readProjectJsonFile,
} from "./lib/projectIO";

import {
  downloadZip,
} from "./lib/zip";

import type {
  Commit,
  GenerationResponse,
  Project,
  VirtualFile,
} from "./types";

const STORAGE_KEY = "forge.projects.v2";
const BACKUP_STORAGE_KEY = "forge.projects.v2.backup";

const MAX_LOCAL_STORAGE_CHARS = 4_500_000;
const MAX_PROJECTS_STORED = 8;
const MAX_COMMITS_PER_PROJECT = 25;
const MAX_FILE_CONTENT_CHARS_IN_HISTORY = 120_000;

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function now() {
  return Date.now();
}

function normalizePath(path: string) {
  if (!path.startsWith("/")) {
    return `/${path}`;
  }

  return path;
}

function createEmptyProject(prompt = ""): Project {
  return {
    id: uid(),
    name: "Untitled Project",
    prompt,
    files: [],
    createdAt: now(),
    updatedAt: now(),
    commits: [],
    nextActions: [],
  };
}

function mergeFiles(
  currentFiles: VirtualFile[],
  changedFiles: VirtualFile[]
) {
  const map = new Map<string, VirtualFile>();

  for (const file of currentFiles) {
    map.set(normalizePath(file.path), {
      path: normalizePath(file.path),
      content: file.content,
    });
  }

  for (const file of changedFiles) {
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

  return Array.from(map.values()).sort((a, b) =>
    a.path.localeCompare(b.path)
  );
}

function compactProjectsForStorage(projects: Project[]) {
  return projects
    .slice(0, MAX_PROJECTS_STORED)
    .map((project) => ({
      ...project,
      commits: (project.commits || [])
        .slice(0, MAX_COMMITS_PER_PROJECT)
        .map((commit) => ({
          ...commit,
          files: (commit.files || []).map((file) => ({
            ...file,
            content:
              file.content &&
              file.content.length >
                MAX_FILE_CONTENT_CHARS_IN_HISTORY
                ? file.content.slice(
                    0,
                    MAX_FILE_CONTENT_CHARS_IN_HISTORY
                  ) + "\n/* HISTORY FILE TRUNCATED */"
                : file.content,
          })),
        })),
    }));
}

function measureStoragePayload(projects: Project[]) {
  return JSON.stringify(projects).length;
}

function safeLoadBackupProjects(): Project[] {
  try {
    const raw = localStorage.getItem(
      BACKUP_STORAGE_KEY
    );

    if (!raw) return [];

    const parsed = JSON.parse(raw);

    return Array.isArray(parsed)
      ? parsed
      : [];
  } catch {
    return [];
  }
}

function safeLoadProjects(): Project[] {
  try {
    const raw = localStorage.getItem(
      STORAGE_KEY
    );

    if (!raw) {
      return safeLoadBackupProjects();
    }

    const parsed = JSON.parse(raw);

    return Array.isArray(parsed)
      ? parsed
      : safeLoadBackupProjects();
  } catch {
    return safeLoadBackupProjects();
  }
}

function safeSaveProjects(projects: Project[]) {
  let safeProjects =
    compactProjectsForStorage(projects);

  let payload = JSON.stringify(safeProjects);

  while (
    payload.length >
      MAX_LOCAL_STORAGE_CHARS &&
    safeProjects.length > 1
  ) {
    safeProjects = safeProjects.slice(0, -1);
    payload = JSON.stringify(safeProjects);
  }

  if (
    payload.length >
    MAX_LOCAL_STORAGE_CHARS
  ) {
    safeProjects = safeProjects.map(
      (project) => ({
        ...project,
        commits: [],
      })
    );

    payload = JSON.stringify(safeProjects);
  }

  localStorage.setItem(
    BACKUP_STORAGE_KEY,
    payload
  );

  localStorage.setItem(
    STORAGE_KEY,
    payload
  );
}

export default function App() {
  const [projects, setProjects] = useState<Project[]>(
    () => safeLoadProjects()
  );

  const [activeProjectId, setActiveProjectId] =
    useState<string>(
      () => safeLoadProjects()?.[0]?.id || ""
    );

  const [selectedPath, setSelectedPath] =
    useState("");

  const [prompt, setPrompt] = useState("");

  const [error, setError] = useState("");

  const [isGenerating, setIsGenerating] =
    useState(false);

  const [
    isAutopilotRunning,
    setIsAutopilotRunning,
  ] = useState(false);

  const [
    autopilotStopRequested,
    setAutopilotStopRequested,
  ] = useState(false);

  const [autopilotLogs, setAutopilotLogs] =
    useState<string[]>([]);

  const [activeJobId, setActiveJobId] =
    useState("");

  const [generationJob, setGenerationJob] =
    useState<any>(null);

  const [buildResult, setBuildResult] =
    useState<any>(null);

  const [inspection, setInspection] =
    useState<any>(null);

  const [
    dependencyResolution,
    setDependencyResolution,
  ] = useState<any>(null);

  const [publishReport, setPublishReport] =
    useState<any>(null);

  const [previewSession, setPreviewSession] =
    useState<any>(null);

  const [previewInfo, setPreviewInfo] =
    useState<any>(null);

  const [lastResponse, setLastResponse] =
    useState<GenerationResponse | null>(
      null
    );

  const [templates, setTemplates] = useState<
    any[]
  >([]);

  const [projectMemory, setProjectMemory] =
    useState<any>(null);

  const [isLoadingMemory, setIsLoadingMemory] =
    useState(false);

  const [buildMode, setBuildMode] =
    useState<BuildMode>("virtual");

  const [
    autopilotTargetScore,
    setAutopilotTargetScore,
  ] = useState(90);

  const [
    autopilotMaxIterations,
    setAutopilotMaxIterations,
  ] = useState(5);

  const [aiConfig, setAiConfig] =
    useState<AiConfig>({
      provider: "gemini",
      model: "gemini-2.5-flash",
    });

  const previewPollRef =
    useRef<number>();

  const activeProject = useMemo(
    () =>
      projects.find(
        (project) =>
          project.id === activeProjectId
      ) || null,
    [projects, activeProjectId]
  );
  const storageSize = useMemo(() => {
    try {
      return measureStoragePayload(projects);
    } catch {
      return 0;
    }
  }, [projects]);

  const selectedFile = useMemo(() => {
    if (!activeProject) return null;

    return (
      activeProject.files.find(
        (file) =>
          normalizePath(file.path) ===
          normalizePath(selectedPath)
      ) || null
    );
  }, [activeProject, selectedPath]);

  useEffect(() => {
    safeSaveProjects(projects);
  }, [projects]);

  useEffect(() => {
    listTemplates()
      .then(setTemplates)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!activeJobId) return;

    const interval = window.setInterval(
      async () => {
        try {
          const job = await getJob(
            activeJobId
          );

          setGenerationJob(job);

          if (
            job.logs?.length
          ) {
            setAutopilotLogs(
              job.logs
            );
          }

          if (
            job.status === "success" &&
            job.result
          ) {
            const baseProject =
              activeProject ||
              createEmptyProject(
                prompt
              );

            if (
              job.result.iterations &&
              job.result.files
            ) {
              const latestIteration =
                job.result.iterations.at(
                  -1
                ) as
                  | GenerationResponse
                  | undefined;

              updateProject({
                ...baseProject,
                prompt,
                files:
                  job.result.files,
                updatedAt: now(),
                score:
                  latestIteration?.score,
                nextActions:
                  latestIteration?.nextActions ||
                  [],
                commits: [
                  {
                    id: uid(),
                    message: `Autopilot completed. Final score: ${job.result.finalScore}`,
                    timestamp:
                      now(),
                    files:
                      job.result.files,
                    score:
                      latestIteration?.score,
                  },
                  ...(baseProject.commits ||
                    []),
                ],
              });

              setLastResponse(
                latestIteration || {
                  files:
                    job.result.files,
                  changelog: `Autopilot completed. Final score: ${job.result.finalScore}`,
                  estimatedTimeSaved:
                    "Several hours saved.",
                  score:
                    latestIteration?.score,
                  nextActions:
                    latestIteration?.nextActions ||
                    [],
                  mode:
                    "improve",
                }
              );

              setAutopilotLogs(
                job.result.logs ||
                  []
              );

              setIsAutopilotRunning(
                false
              );

              setSelectedPath(
                job.result.files?.[0]
                  ?.path || ""
              );
            } else {
              const response =
                job.result as GenerationResponse;

              const merged =
                mergeFiles(
                  baseProject.files ||
                    [],
                  response.files ||
                    []
                );

              updateProject({
                ...baseProject,
                prompt,
                files: merged,
                updatedAt: now(),
                score:
                  response.score,
                nextActions:
                  response.nextActions ||
                  [],
                commits: [
                  {
                    id: uid(),
                    message:
                      response.changelog ||
                      "AI generation job",
                    timestamp:
                      now(),
                    files:
                      response.files ||
                      [],
                    score:
                      response.score,
                  },
                  ...(baseProject.commits ||
                    []),
                ],
              });

              setLastResponse(
                response
              );

              setSelectedPath(
                response.files?.[0]
                  ?.path ||
                  merged[0]
                    ?.path ||
                  ""
              );
            }

            setIsGenerating(
              false
            );

            setActiveJobId("");

            clearInterval(
              interval
            );
          }

          if (
            job.status === "error"
          ) {
            setError(
              job.error ||
                "Job failed."
            );

            setIsGenerating(
              false
            );

            setIsAutopilotRunning(
              false
            );

            setActiveJobId("");

            clearInterval(
              interval
            );
          }
        } catch {
          clearInterval(
            interval
          );
        }
      },
      2000
    );

    return () =>
      clearInterval(interval);
  }, [
    activeJobId,
    activeProject,
    prompt,
  ]);

  useEffect(() => {
    if (
      !previewSession?.id
    ) {
      return;
    }

    previewPollRef.current =
      window.setInterval(
        async () => {
          try {
            const session =
              await getPreview(
                previewSession.id
              );

            setPreviewInfo(
              session
            );
          } catch {}
        },
        2000
      );

    return () => {
      if (
        previewPollRef.current
      ) {
        clearInterval(
          previewPollRef.current
        );
      }
    };
  }, [previewSession]);

  function pushAutopilotLog(
    message: string
  ) {
    setAutopilotLogs(
      (previous) => [
        `${new Date().toISOString()} · ${message}`,
        ...previous,
      ]
    );
  }

  function updateProject(
    project: Project
  ) {
    setProjects(
      (previous) => {
        const exists =
          previous.some(
            (item) =>
              item.id ===
              project.id
          );

        if (!exists) {
          return [
            project,
            ...previous,
          ];
        }

        return previous.map(
          (item) =>
            item.id ===
            project.id
              ? project
              : item
        );
      }
    );

    setActiveProjectId(
      project.id
    );
  }

  function recoverBackupProjects() {
    const backup =
      safeLoadBackupProjects();

    if (!backup.length) {
      setError(
        "No backup found."
      );

      return;
    }

    setProjects(backup);

    setActiveProjectId(
      backup[0]?.id || ""
    );

    setSelectedPath(
      backup[0]?.files?.[0]
        ?.path || ""
    );

    setError("");
  }

  function updateFileContent(
    path: string,
    content: string
  ) {
    if (!activeProject)
      return;

    const updatedFiles =
      activeProject.files.map(
        (file) =>
          normalizePath(
            file.path
          ) ===
          normalizePath(path)
            ? {
                ...file,
                content,
              }
            : file
      );

    updateProject({
      ...activeProject,
      files: updatedFiles,
      updatedAt: now(),
    });
  }

  function createNewProject() {
    const project =
      createEmptyProject();

    updateProject(project);

    setSelectedPath("");
    setPrompt("");
    setLastResponse(null);
    setBuildResult(null);
    setInspection(null);
    setDependencyResolution(
      null
    );
    setPublishReport(null);
    setPreviewSession(null);
    setPreviewInfo(null);
    setProjectMemory(null);
    setError("");
}

function deleteProject(projectId: string) {
    const filtered = projects.filter(
      (project) => project.id !== projectId
    );

    setProjects(filtered);

    if (activeProjectId === projectId) {
      setActiveProjectId(filtered[0]?.id || "");
      setSelectedPath(filtered[0]?.files?.[0]?.path || "");
    }
  }

  function renameProject(name: string) {
    if (!activeProject) return;

    updateProject({
      ...activeProject,
      name,
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

  function restoreCommit(commit: Commit) {
    if (!activeProject) return;

    const restoredFiles = mergeFiles(
      activeProject.files,
      commit.files
    );

    updateProject({
      ...activeProject,
      files: restoredFiles,
      updatedAt: now(),
      commits: [
        {
          id: uid(),
          message: `Restored: ${commit.message}`,
          timestamp: now(),
          files: commit.files,
          score: commit.score,
        },
        ...activeProject.commits,
      ],
    });

    setSelectedPath(restoredFiles[0]?.path || "");
  }

  function compactHistory() {
    if (!activeProject) return;

    updateProject({
      ...activeProject,
      commits: activeProject.commits.slice(0, 10),
      updatedAt: now(),
    });
  }

  function addFile() {
    if (!activeProject) return;

    const fileName = window.prompt(
      "File path:",
      "/src/new-file.ts"
    );

    if (!fileName) return;

    const path = normalizePath(fileName);

    if (
      activeProject.files.some(
        (file) => normalizePath(file.path) === path
      )
    ) {
      setError("File already exists.");
      return;
    }

    const updatedFiles = [
      ...activeProject.files,
      {
        path,
        content: "",
      },
    ].sort((a, b) => a.path.localeCompare(b.path));

    updateProject({
      ...activeProject,
      files: updatedFiles,
      updatedAt: now(),
    });

    setSelectedPath(path);
  }

  function deleteSelectedFile() {
    if (!activeProject || !selectedFile) return;

    const updatedFiles = activeProject.files.filter(
      (file) =>
        normalizePath(file.path) !==
        normalizePath(selectedFile.path)
    );

    updateProject({
      ...activeProject,
      files: updatedFiles,
      updatedAt: now(),
    });

    setSelectedPath(updatedFiles[0]?.path || "");
  }

  async function handleGenerate(auto = false) {
    const finalPrompt = prompt.trim();

    if (!finalPrompt) {
      setError("Prompt required.");
      return;
    }

    setError("");
    setIsGenerating(true);

    try {
      const baseProject =
        activeProject || createEmptyProject(finalPrompt);

      const response = await generateProject({
        projectId: baseProject.id,
        prompt: finalPrompt,
        currentFiles: baseProject.files,
        isAutoImprove: auto,
        aiConfig,
        buildMode,
      });

      const merged = mergeFiles(
        baseProject.files,
        response.files || []
      );

      updateProject({
        ...baseProject,
        prompt: finalPrompt,
        files: merged,
        updatedAt: now(),
        score: response.score,
        nextActions: response.nextActions || [],
        commits: [
          {
            id: uid(),
            message:
              response.changelog ||
              "AI generation",
            timestamp: now(),
            files: response.files || [],
            score: response.score,
          },
          ...baseProject.commits,
        ],
      });

      setLastResponse(response);
      setSelectedPath(response.files?.[0]?.path || merged[0]?.path || "");
    } catch (err: any) {
      setError(err?.message || "Generation failed.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleGenerateJob(auto = false) {
    const finalPrompt = prompt.trim();

    if (!finalPrompt) {
      setError("Prompt required.");
      return;
    }

    setError("");
    setIsGenerating(true);
    setGenerationJob(null);

    try {
      const baseProject =
        activeProject || createEmptyProject(finalPrompt);

      const jobId = await startGenerationJob({
        projectId: baseProject.id,
        prompt: finalPrompt,
        currentFiles: baseProject.files,
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

  async function handleAutopilot() {
    if (!activeProject) {
      setError("Create a project first.");
      return;
    }

    setError("");
    setAutopilotLogs([]);
    setIsAutopilotRunning(true);
    setAutopilotStopRequested(false);

    try {
      const jobId = await startAutopilotJob({
        projectId: activeProject.id,
        prompt:
          activeProject.prompt ||
          prompt ||
          "Improve this project until it is production-ready.",
        files: activeProject.files,
        aiConfig,
        buildMode,
        targetScore: autopilotTargetScore,
        maxIterations: autopilotMaxIterations,
      });

      setActiveJobId(jobId);
      pushAutopilotLog(`Autopilot job started: ${jobId}`);
    } catch (err: any) {
      setError(err?.message || "Autopilot failed.");
      setIsAutopilotRunning(false);
    }
  }

  function stopAutopilot() {
    setAutopilotStopRequested(true);
    setIsAutopilotRunning(false);
    pushAutopilotLog("Stop requested locally.");
  }

  async function runAction(action: string) {
    setPrompt(action);
    await handleGenerateJob(true);
  }

  async function runAllActions() {
    if (!activeProject?.nextActions?.length) return;

    setPrompt(activeProject.nextActions.join("\n"));
    await handleGenerateJob(true);
  }

  async function handleBuildCheck() {
    if (!activeProject) return;

    setError("");

    try {
      const result = await checkBuild({
        files: activeProject.files,
        mode: buildMode,
      });

      setBuildResult(result);
    } catch (err: any) {
      setError(err?.message || "Build check failed.");
    }
      }

async function handleScoreProject() {
    if (!activeProject) return;

    try {
      const score = await scoreProject(activeProject.files);

      updateProject({
        ...activeProject,
        score,
        updatedAt: now(),
      });
    } catch (err: any) {
      setError(err?.message || "Score failed.");
    }
  }

  async function handleInspectProject() {
    if (!activeProject) return;

    try {
      const result = await inspectProject(activeProject.files);
      setInspection(result);
    } catch (err: any) {
      setError(err?.message || "Inspection failed.");
    }
  }

  async function handleResolveDependencies(apply = false) {
    if (!activeProject) return;

    try {
      const result = await resolveDependencies({
        files: activeProject.files,
        apply,
      });

      setDependencyResolution(result.resolution);

      if (apply && result.files) {
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
                (file) => normalizePath(file.path) === "/package.json"
              ),
              score: activeProject.score,
            },
            ...activeProject.commits,
          ],
        });
      }
    } catch (err: any) {
      setError(err?.message || "Dependency resolution failed.");
    }
  }

  async function handleCreateDeploymentPack() {
    if (!activeProject) return;

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
    } catch (err: any) {
      setError(err?.message || "Deployment pack failed.");
    }
  }

  async function handleCreatePublishReport() {
    if (!activeProject) return;

    try {
      const report = await createPublishReport(activeProject.files);
      setPublishReport(report);
    } catch (err: any) {
      setError(err?.message || "Publish report failed.");
    }
  }

  async function handleStartPreview() {
    if (!activeProject?.files?.length) return;

    try {
      if (previewSession?.id) {
        await stopPreview(previewSession.id);
      }

      const session = await startPreview(activeProject.files);
      setPreviewSession(session);
      setPreviewInfo(session);
    } catch (err: any) {
      setError(err?.message || "Preview start failed.");
    }
  }

  async function handleStopPreview() {
    if (!previewSession?.id) return;

    try {
      const session = await stopPreview(previewSession.id);
      setPreviewSession(session);
      setPreviewInfo(session);
    } catch (err: any) {
      setError(err?.message || "Preview stop failed.");
    }
  }

  async function handleLoadMemory() {
    if (!activeProject) return;

    setIsLoadingMemory(true);

    try {
      const memory = await getProjectMemory(activeProject.id);
      setProjectMemory(memory);
    } catch (err: any) {
      setProjectMemory({
        projectId: activeProject.id,
        recurringProblems: [err?.message || "Memory load failed."],
        successfulFixes: [],
        architectureNotes: [],
        buildHistory: [],
      });
    } finally {
      setIsLoadingMemory(false);
    }
  }

  async function handleResetMemory() {
    if (!activeProject) return;

    setIsLoadingMemory(true);

    try {
      const memory = await resetProjectMemory(activeProject.id);
      setProjectMemory(memory);
    } catch (err: any) {
      setProjectMemory({
        projectId: activeProject.id,
        recurringProblems: [err?.message || "Memory reset failed."],
        successfulFixes: [],
        architectureNotes: [],
        buildHistory: [],
      });
    } finally {
      setIsLoadingMemory(false);
    }
  }

  async function handleApplyTemplate(templateId: string) {
    try {
      const template = await applyTemplate(templateId);

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
      setSelectedPath(template.files?.[0]?.path || "");
      setLastResponse(null);
      setBuildResult(null);
      setInspection(null);
      setDependencyResolution(null);
      setPublishReport(null);
      setProjectMemory(null);
    } catch (err: any) {
      setError(err?.message || "Template apply failed.");
    }
  }

  function handleExportZip() {
    if (!activeProject) return;
    downloadZip(activeProject.files, activeProject.name || "forge-project");
  }

  function handleExportProjectJson() {
    if (!activeProject) return;
    exportProjectAsJson(activeProject);
  }

  async function handleImportProjectJson(file?: File | null) {
    if (!file) return;

    try {
      const importedProject = await readProjectJsonFile(file);

      updateProject({
        ...importedProject,
        id: importedProject.id || uid(),
        updatedAt: now(),
      });

      setSelectedPath(importedProject.files?.[0]?.path || "");
      setBuildResult(null);
      setLastResponse(null);
      setInspection(null);
      setDependencyResolution(null);
      setPublishReport(null);
      setProjectMemory(null);
      setError("");
    } catch (err: any) {
      setError(err?.message || "Project import failed.");
    }
  }

  const healthScore = activeProject?.score;

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <div className="mx-auto flex min-h-screen max-w-[1800px] flex-col p-4">
        <header className="mb-4 rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">
                Forge
              </p>

              <h1 className="text-3xl font-black tracking-tight">
                AI App Builder
              </h1>

              <p className="mt-1 text-sm text-zinc-400">
                Generate, repair, preview, score and export app projects.
              </p>

              {activeProject && (
                <input
                  value={activeProject.name}
                  onChange={(event) => renameProject(event.target.value)}
                  className="mt-3 w-full max-w-md rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-sm font-bold text-white outline-none"
                />
              )}

              <p className="mt-2 text-[11px] text-zinc-600">
                Local storage: {(storageSize / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={createNewProject}
                className="rounded-2xl border border-white/10 px-4 py-2 text-xs font-bold hover:bg-white/10"
              >
                New
              </button>

              <button
                onClick={duplicateProject}
                disabled={!activeProject}
                className="rounded-2xl border border-white/10 px-4 py-2 text-xs font-bold hover:bg-white/10 disabled:opacity-40"
              >
                Duplicate
              </button>

              <button
                onClick={recoverBackupProjects}
                className="rounded-2xl border border-white/10 px-4 py-2 text-xs font-bold hover:bg-white/10"
              >
                Recover
              </button>

              <button
                onClick={handleExportProjectJson}
                disabled={!activeProject}
                className="rounded-2xl border border-white/10 px-4 py-2 text-xs font-bold hover:bg-white/10 disabled:opacity-40"
              >
                Export JSON
              </button>

              <label className="cursor-pointer rounded-2xl border border-white/10 px-4 py-2 text-xs font-bold hover:bg-white/10">
                Import JSON
                <input
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(event) =>
                    handleImportProjectJson(event.target.files?.[0])
                  }
                />
              </label>

              <button
                onClick={handleExportZip}
                disabled={!activeProject?.files?.length}
                className="rounded-2xl bg-white px-4 py-2 text-xs font-black text-black disabled:opacity-40"
              >
                Export ZIP
              </button>
            </div>
          </div>
        </header>

        <main className="grid flex-1 gap-4 xl:grid-cols-[300px_minmax(0,1fr)_390px]">
          <aside className="space-y-4">
            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold">Projects</h2>
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
                    type="button"
                    onClick={() => {
                      setActiveProjectId(project.id);
                      setSelectedPath(project.files?.[0]?.path || "");
                      setLastResponse(null);
                      setBuildResult(null);
                      setInspection(null);
                      setDependencyResolution(null);
                      setPublishReport(null);
                      setProjectMemory(null);
                    }}
                    className={`w-full rounded-2xl border p-3 text-left transition ${
                      project.id === activeProject?.id
                        ? "border-white/30 bg-white/10"
                        : "border-white/10 bg-black/25 hover:bg-white/10"
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
                          deleteProject(project.id);
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

            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl">
              <h2 className="mb-3 text-sm font-bold">Templates</h2>

              <div className="space-y-2">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => handleApplyTemplate(template.id)}
                    className="w-full rounded-2xl border border-white/10 bg-black/25 p-3 text-left hover:bg-white/10"
                  >
                    <p className="text-sm font-bold">{template.name}</p>
                    <p className="mt-1 text-xs leading-5 text-zinc-500">
                      {template.description}
                    </p>
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold">Files</h2>

                <div className="flex gap-2">
                  <button
                    onClick={addFile}
                    disabled={!activeProject}
                    className="rounded-xl bg-white px-3 py-1.5 text-[11px] font-bold text-black disabled:opacity-40"
                  >
                    Add
                  </button>

                  <button
                    onClick={deleteSelectedFile}
                    disabled={!selectedFile}
                    className="rounded-xl border border-red-400/20 px-3 py-1.5 text-[11px] font-bold text-red-300 disabled:opacity-40"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {activeProject?.files?.length ? (
                <FileTree
                  files={activeProject.files}
                  selectedPath={selectedPath}
                  onSelect={setSelectedPath}
                />
              ) : (
                <p className="rounded-2xl border border-dashed border-white/10 p-4 text-xs text-zinc-500">
                  No generated files.
                </p>
              )}
            </section>
          </aside>

          <section className="flex min-w-0 flex-col gap-4">
            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl">
              <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-sm font-bold">Prompt</h2>
                  <p className="text-xs text-zinc-500">
                    Describe the app or the improvement task.
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
                placeholder="Create a premium mobile-first SaaS dashboard..."
                className="min-h-36 w-full resize-none rounded-3xl border border-white/10 bg-black/40 p-4 text-sm text-white outline-none placeholder:text-zinc-600"
              />

              {error && (
                <div className="mt-3 rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">
                  {error}
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => handleGenerateJob(false)}
                  disabled={isGenerating}
                  className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-black disabled:opacity-50"
                >
                  {isGenerating ? "Generating..." : "Generate Job"}
                </button>

                <button
                  onClick={() => handleGenerate(false)}
                  disabled={isGenerating}
                  className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-bold hover:bg-white/10 disabled:opacity-50"
                >
                  Generate Sync
                </button>

                <button
                  onClick={() => handleGenerateJob(true)}
                  disabled={isGenerating || !activeProject?.files?.length}
                  className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-bold hover:bg-white/10 disabled:opacity-50"
                >
                  Improve
                </button>

                <button
                  onClick={handleAutopilot}
                  disabled={isAutopilotRunning || !activeProject?.files?.length}
                  className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-bold hover:bg-white/10 disabled:opacity-50"
                >
                  {isAutopilotRunning ? "Autopilot..." : "Autopilot"}
                </button>

                <button
                  onClick={stopAutopilot}
                  disabled={!isAutopilotRunning}
                  className="rounded-2xl border border-red-400/20 px-5 py-3 text-sm font-bold text-red-300 disabled:opacity-40"
                >
                  Stop
                </button>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label>
                  <span className="mb-1 block text-xs text-zinc-500">
                    Autopilot target score
                  </span>
                  <input
                    type="number"
                    min={50}
                    max={100}
                    value={autopilotTargetScore}
                    onChange={(event) =>
                      setAutopilotTargetScore(Number(event.target.value))
                    }
                    className="w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none"
                  />
                </label>

                <label>
                  <span className="mb-1 block text-xs text-zinc-500">
                    Max iterations
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={autopilotMaxIterations}
                    onChange={(event) =>
                      setAutopilotMaxIterations(Number(event.target.value))
                    }
                    className="w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none"
                  />
                </label>
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl">
              <div className="mb-3 flex flex-wrap gap-2">
                <button
                  onClick={handleBuildCheck}
                  disabled={!activeProject}
                  className="rounded-2xl border border-white/10 px-4 py-2 text-xs font-bold hover:bg-white/10 disabled:opacity-40"
                >
                  Build Check
                </button>

                <button
                  onClick={handleScoreProject}
                  disabled={!activeProject}
                  className="rounded-2xl border border-white/10 px-4 py-2 text-xs font-bold hover:bg-white/10 disabled:opacity-40"
                >
                  Score
                </button>

                <button
                  onClick={handleInspectProject}
                  disabled={!activeProject}
                  className="rounded-2xl border border-white/10 px-4 py-2 text-xs font-bold hover:bg-white/10 disabled:opacity-40"
                >
                  Inspect
                </button>

                <button
                  onClick={() => handleResolveDependencies(false)}
                  disabled={!activeProject}
                  className="rounded-2xl border border-white/10 px-4 py-2 text-xs font-bold hover:bg-white/10 disabled:opacity-40"
                >
                  Deps
                </button>

                <button
                  onClick={() => handleResolveDependencies(true)}
                  disabled={!activeProject}
                  className="rounded-2xl border border-white/10 px-4 py-2 text-xs font-bold hover:bg-white/10 disabled:opacity-40"
                >
                  Fix Deps
                </button>

                <button
                  onClick={handleCreateDeploymentPack}
                  disabled={!activeProject}
                  className="rounded-2xl border border-white/10 px-4 py-2 text-xs font-bold hover:bg-white/10 disabled:opacity-40"
                >
                  Deploy Pack
                </button>

                <button
                  onClick={handleCreatePublishReport}
                  disabled={!activeProject}
                  className="rounded-2xl border border-white/10 px-4 py-2 text-xs font-bold hover:bg-white/10 disabled:opacity-40"
                >
                  Publish Report
                </button>

                <button
                  onClick={handleStartPreview}
                  disabled={!activeProject?.files?.length}
                  className="rounded-2xl bg-white px-4 py-2 text-xs font-bold text-black disabled:opacity-40"
                >
                  Start Preview
                </button>

                <button
                  onClick={handleStopPreview}
                  disabled={!previewSession?.id}
                  className="rounded-2xl border border-red-400/20 px-4 py-2 text-xs font-bold text-red-300 disabled:opacity-40"
                >
                  Stop Preview
                </button>
              </div>

              <PreviewPanel
                files={activeProject?.files || []}
                session={previewInfo}
              />
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <div className="min-h-[620px] overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] shadow-2xl">
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">
                      {selectedFile?.path || "No file selected"}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {selectedFile?.content?.length
                        ? `${selectedFile.content.length.toLocaleString()} characters`
                        : "Select a file"}
                    </p>
                  </div>
                </div>

                <CodeEditor
                  file={selectedFile}
                  onChange={(content) => {
                    if (!selectedFile) return;
                    updateFileContent(selectedFile.path, content);
                  }}
                />
              </div>

              <div className="space-y-4">
                {generationJob && (
                  <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl">
                    <div className="mb-3 flex items-center justify-between">
                      <h2 className="text-sm font-bold">Job</h2>
                      <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-300">
                        {generationJob.status}
                      </span>
                    </div>

                    {generationJob.error && (
                      <div className="mb-3 rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-xs text-red-200">
                        {generationJob.error}
                      </div>
                    )}

                    <div className="max-h-80 overflow-auto rounded-2xl bg-black/40 p-3">
                      {(generationJob.logs || []).map((log: string, index: number) => (
                        <p key={`${log}-${index}`} className="text-xs leading-5 text-zinc-400">
                          {log}
                        </p>
                      ))}
                    </div>
                  </section>
                )}

                {lastResponse && (
                  <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl">
                    <h2 className="mb-2 text-sm font-bold">Last response</h2>
                    <p className="whitespace-pre-wrap text-xs leading-6 text-zinc-300">
                      {lastResponse.changelog}
                    </p>
                  </section>
                )}

                {autopilotLogs.length > 0 && (
                  <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl">
                    <h2 className="mb-3 text-sm font-bold">Autopilot logs</h2>
                    <div className="max-h-80 overflow-auto rounded-2xl bg-black/40 p-3">
                      {autopilotLogs.map((log, index) => (
                        <p key={`${log}-${index}`} className="text-xs leading-5 text-zinc-400">
                          {log}
                        </p>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            </section>
          </section>

          <aside className="space-y-4">
            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl">
              <h2 className="mb-3 text-sm font-bold">AI Provider</h2>

              <div className="space-y-3">
                <label className="block">
                  <span className="mb-1 block text-xs text-zinc-500">
                    Provider
                  </span>
                  <select
                    value={aiConfig.provider || "gemini"}
                    onChange={(event) =>
                      setAiConfig((previous) => ({
                        ...previous,
                        provider: event.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none"
                  >
                    <option value="gemini">Gemini</option>
                    <option value="openai">OpenAI-compatible</option>
                    <option value="groq">Groq/custom</option>
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs text-zinc-500">
                    Model
                  </span>
                  <input
                    value={aiConfig.model || ""}
                    onChange={(event) =>
                      setAiConfig((previous) => ({
                        ...previous,
                        model: event.target.value,
                      }))
                    }
                    placeholder="gemini-2.5-flash"
                    className="w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none placeholder:text-zinc-700"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs text-zinc-500">
                    API key
                  </span>
                  <input
                    type="password"
                    value={aiConfig.apiKey || ""}
                    onChange={(event) =>
                      setAiConfig((previous) => ({
                        ...previous,
                        apiKey: event.target.value,
                      }))
                    }
                    placeholder="Optional if .env is configured"
                    className="w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none placeholder:text-zinc-700"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs text-zinc-500">
                    Base URL
                  </span>
                  <input
                    value={aiConfig.baseUrl || ""}
                    onChange={(event) =>
                      setAiConfig((previous) => ({
                        ...previous,
                        baseUrl: event.target.value,
                      }))
                    }
                    placeholder="https://api.groq.com/openai/v1"
                    className="w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none placeholder:text-zinc-700"
                  />
                </label>
              </div>
            </section>

            <ScorePanel score={healthScore} nextActions={activeProject?.nextActions || []} />

            <ProjectHealthPanel
              score={activeProject?.score}
              buildResult={buildResult}
              publishReport={publishReport}
              memory={projectMemory}
            />

            <MemoryPanel
              memory={projectMemory}
              loading={isLoadingMemory}
              onLoad={handleLoadMemory}
              onReset={handleResetMemory}
            />

            {activeProject?.nextActions?.length ? (
              <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h2 className="text-sm font-bold">Next actions</h2>

                  <button
                    onClick={runAllActions}
                    className="rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-black"
                  >
                    Run all
                  </button>
                </div>

                <div className="space-y-2">
                  {activeProject.nextActions.map((action) => (
                    <div
                      key={action}
                      className="rounded-2xl border border-white/10 bg-black/25 p-3"
                    >
                      <p className="text-xs leading-5 text-zinc-300">{action}</p>

                      <button
                        onClick={() => runAction(action)}
                        className="mt-2 rounded-xl border border-white/10 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-white/10"
                      >
                        Run
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {buildResult && (
              <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl">
                <h2 className="mb-2 text-sm font-bold">Build result</h2>
                <p
                  className={
                    buildResult.ok
                      ? "text-sm font-bold text-emerald-300"
                      : "text-sm font-bold text-red-300"
                  }
                >
                  {buildResult.ok ? "PASS" : "FAIL"}
                </p>

                {buildResult.issues?.length > 0 && (
                  <ul className="mt-3 space-y-1 text-xs text-zinc-300">
                    {buildResult.issues.slice(0, 8).map((issue: any, index: number) => (
                      <li key={`${issue.message}-${index}`}>
                        • {issue.file ? `${issue.file}: ` : ""}
                        {issue.message}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {inspection && (
              <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl">
                <h2 className="mb-3 text-sm font-bold">Inspection</h2>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <Info label="Framework" value={inspection.framework} />
                  <Info label="Language" value={inspection.language} />
                  <Info label="Package" value={inspection.packageManager} />
                  <Info label="Entrypoints" value={inspection.entrypoints?.length || 0} />
                </div>

                <List title="Risks" items={inspection.risks} />
                <List title="Strengths" items={inspection.strengths} />
              </section>
            )}

            {dependencyResolution && (
              <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl">
                <h2 className="mb-3 text-sm font-bold">Dependencies</h2>

                <p
                  className={
                    dependencyResolution.ok
                      ? "text-sm font-bold text-emerald-300"
                      : "text-sm font-bold text-amber-300"
                  }
                >
                  {dependencyResolution.ok ? "OK" : "Needs update"}
                </p>

                <List
                  title="Missing"
                  items={dependencyResolution.missingDependencies || []}
                />

                <List
                  title="Warnings"
                  items={dependencyResolution.warnings || []}
                />
              </section>
            )}

            {publishReport && (
              <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl">
                <h2 className="mb-3 text-sm font-bold">Publish report</h2>

                <p
                  className={
                    publishReport.ready
                      ? "text-sm font-bold text-emerald-300"
                      : "text-sm font-bold text-red-300"
                  }
                >
                  {publishReport.ready ? "READY" : "BLOCKED"} · {publishReport.score}/100
                </p>

                <List title="Blockers" items={publishReport.blockers || []} />
                <List title="Warnings" items={publishReport.warnings || []} />
              </section>
            )}

            {activeProject?.commits?.length ? (
              <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h2 className="text-sm font-bold">History</h2>

                  <button
                    onClick={compactHistory}
                    className="rounded-xl border border-white/10 px-3 py-1.5 text-xs font-bold hover:bg-white/10"
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
                        {commit.files.length} files
                      </p>

                      <button
                        onClick={() => restoreCommit(commit)}
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

function Info({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
      <p className="text-[11px] text-zinc-500">{label}</p>
      <p className="mt-1 truncate text-xs font-bold text-white">
        {String(value ?? "—")}
      </p>
    </div>
  );
}

function List({ title, items = [] }: { title: string; items?: string[] }) {
  if (!items.length) return null;

  return (
    <div className="mt-3 rounded-2xl border border-white/10 bg-black/25 p-3">
      <p className="mb-2 text-xs font-bold text-white">{title}</p>
      <ul className="space-y-1 text-xs text-zinc-300">
        {items.slice(0, 8).map((item) => (
          <li key={item}>• {item}</li>
        ))}
      </ul>
    </div>
  );
                      }
