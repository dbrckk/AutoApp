import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";

import { BuildPanel } from "./components/BuildPanel";
import { CodeViewer } from "./components/CodeViewer";
import { FileEditorPanel } from "./components/FileEditorPanel";
import { FileTree } from "./components/FileTree";
import { PreviewPanel } from "./components/PreviewPanel";
import { ScorePanel } from "./components/ScorePanel";
import { checkBuild, generateProject, type AiConfig, type BuildMode } from "./lib/api";
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

  function updateProject(project: Project) {
    setProjects((prev) => {
      const exists = prev.some((p) => p.id === project.id);
      if (!exists) return [project, ...prev];
      return prev.map((p) => (p.id === project.id ? project : p));
    });

    setActiveProjectId(project.id);
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

      if (response.files?.[0]?.path) {
        setSelectedPath(response.files[0].path);
      } else if (merged[0]?.path) {
        setSelectedPath(merged[0].path);
      }
    } catch (err: any) {
      setError(err?.message || "Generation failed.");
    } finally {
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
      await handleGenerate(
        [
          "Improve this project aggressively.",
          "Fix weak architecture, UI, mobile UX, SEO, accessibility, reliability, monetization, error states, and production readiness.",
          "Keep all existing features working.",
          "Return only complete changed files.",
        ].join(" "),
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

  async function handleExportZip() {
    if (!activeProject) return;
    await downloadZip(activeProject.files, activeProject.name || "forge-project");
  }

  function copySelectedFile() {
    if (!selectedFile?.content) return;
    navigator.clipboard.writeText(selectedFile.content);
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.10),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.08),transparent_28%)]" />

      <div className="relative mx-auto flex min-h-screen max-w-[1600px] flex-col p-4 lg:p-6">
        <header className="mb-4 flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">Forge</p>
            <h1 className="text-2xl font-black tracking-tight text-white md:text-4xl">
              AI App Builder
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-zinc-400">
              Generate, improve, score, repair, preview, edit and export production-ready app projects.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleNewProject}
              className="rounded-2xl border border-white/10 px-4 py-2 text-xs font-bold text-white hover:bg-white/10"
            >
              New project
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

        <main className="grid flex-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)_380px]">
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
                  onClick={() => handleGenerate()}
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

            <PreviewPanel files={activeProject?.files || []} />

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

            <BuildPanel
              result={buildResult}
              loading={isCheckingBuild}
              onCheckVirtual={() => handleBuildCheck("virtual")}
              onCheckReal={() => handleBuildCheck("real")}
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
                <h2 className="mb-3 text-sm font-semibold">History</h2>

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
