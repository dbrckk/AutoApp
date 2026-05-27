import type { GenerationResponse, VirtualFile } from "../types";

const API_BASE_URL = "https://autoapp-api.dbrak7108.workers.dev";
const API_TIMEOUT_MS = 120_000;

export type BuildMode = "none" | "virtual" | "real";

export type AiConfig = {
  provider?: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
};

export type AutonomousJob = {
  id: string;
  prompt: string;
  status: "running" | "paused" | "done" | "error";
  phase: string;
  target: string;
  score: number;
  attempts: number;
  max_attempts: number;
  error?: string;
  created_at: number;
  updated_at: number;
  next_run_at: number;
  last_score?: number;
  stagnant_steps?: number;
  strategy?: string;
};

export type GitHubExportResponse = {
  ok: boolean;
  repo?: string;
  branch?: string;
  commitSha?: string;
  commitUrl?: string;
  error?: string;
};

function buildApiUrl(path: string) {
  if (path.startsWith("http")) return path;

  const base = API_BASE_URL.replace(/\/$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;

  return `${base}${cleanPath}`;
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController();

  const timeout = window.setTimeout(() => {
    controller.abort();
  }, API_TIMEOUT_MS);

  try {
    const response = await fetch(buildApiUrl(url), {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(options?.headers || {}),
      },
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(data?.error || `Request failed: ${response.status}`);
    }

    return data as T;
  } catch (error: any) {
    if (error?.name === "AbortError") {
      throw new Error(
        "Request timed out. Try a shorter prompt or use autonomous build continuation."
      );
    }

    if (String(error?.message || "").toLowerCase().includes("failed to fetch")) {
      throw new Error(
        "Cannot reach AutoApp API. Check that the Cloudflare Worker is deployed and CORS is enabled."
      );
    }

    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function checkApiHealth() {
  return request<{
    ok: boolean;
    service?: string;
    runtime?: string;
    timestamp?: number;
  }>("/api/health");
}

export async function testGeminiApi() {
  return request<{
    ok: boolean;
    provider: string;
    result?: any;
    error?: string;
  }>("/api/ai/test");
}

export async function generateProject(params: {
  projectId?: string;
  prompt: string;
  currentFiles: VirtualFile[];
  isAutoImprove?: boolean;
  aiConfig?: AiConfig;
  buildMode?: BuildMode;
}): Promise<GenerationResponse> {
  return request<GenerationResponse>("/api/generate", {
    method: "POST",
    body: JSON.stringify({
      projectId: params.projectId,
      prompt: params.prompt,
      currentFiles: params.currentFiles,
      isAutoImprove: Boolean(params.isAutoImprove),
      aiConfig: params.aiConfig,
      buildMode: params.buildMode || "virtual",
    }),
  });
}

export async function startGenerationJob(params: {
  projectId?: string;
  prompt: string;
  currentFiles: VirtualFile[];
  isAutoImprove?: boolean;
  aiConfig?: AiConfig;
  buildMode?: BuildMode;
}) {
  const data = await request<{ ok: boolean; jobId: string }>(
    "/api/generate-job",
    {
      method: "POST",
      body: JSON.stringify({
        projectId: params.projectId,
        prompt: params.prompt,
        currentFiles: params.currentFiles,
        isAutoImprove: Boolean(params.isAutoImprove),
        aiConfig: params.aiConfig,
        buildMode: params.buildMode || "virtual",
      }),
    }
  );

  return data.jobId;
}

export async function startAutopilotJob(params: {
  projectId?: string;
  prompt: string;
  files: VirtualFile[];
  aiConfig?: AiConfig;
  buildMode?: BuildMode;
  targetScore?: number;
  maxIterations?: number;
}) {
  const data = await request<{ ok: boolean; jobId: string }>(
    "/api/autopilot/run",
    {
      method: "POST",
      body: JSON.stringify({
        projectId: params.projectId,
        prompt: params.prompt,
        files: params.files,
        aiConfig: params.aiConfig,
        buildMode: params.buildMode || "virtual",
        targetScore: params.targetScore || 90,
        maxIterations: params.maxIterations || 5,
      }),
    }
  );

  return data.jobId;
}

export async function getJob(jobId: string) {
  return request<any>(`/api/jobs/${jobId}`);
}

export async function checkBuild(params: {
  files: VirtualFile[];
  mode?: BuildMode;
}) {
  return request<any>("/api/build/check", {
    method: "POST",
    body: JSON.stringify({
      files: params.files,
      mode: params.mode || "virtual",
    }),
  });
}

export async function scoreProject(files: VirtualFile[]) {
  const data = await request<{ ok: boolean; score: any }>("/api/score", {
    method: "POST",
    body: JSON.stringify({ files }),
  });

  return data.score;
}

export async function inspectProject(files: VirtualFile[]) {
  const data = await request<{ ok: boolean; inspection: any }>("/api/inspect", {
    method: "POST",
    body: JSON.stringify({ files }),
  });

  return data.inspection;
}

export async function resolveDependencies(params: {
  files: VirtualFile[];
  apply?: boolean;
}) {
  return request<{
    ok: boolean;
    resolution: any;
    files?: VirtualFile[];
  }>("/api/dependencies/resolve", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function createDeploymentPack(files: VirtualFile[]) {
  const data = await request<{
    ok: boolean;
    files: VirtualFile[];
    count: number;
  }>("/api/deployment/pack", {
    method: "POST",
    body: JSON.stringify({ files }),
  });

  return data.files;
}

export async function createPublishReport(files: VirtualFile[]) {
  const data = await request<{ ok: boolean; report: any }>(
    "/api/publish/report",
    {
      method: "POST",
      body: JSON.stringify({ files }),
    }
  );

  return data.report;
}

export async function listTemplates() {
  const data = await request<{ ok: boolean; templates: any[] }>("/api/templates");
  return data.templates;
}

export async function applyTemplate(id: string) {
  const data = await request<{ ok: boolean; template: any }>(
    "/api/templates/apply",
    {
      method: "POST",
      body: JSON.stringify({ id }),
    }
  );

  return data.template;
}

export async function startPreview(files: VirtualFile[]) {
  const data = await request<{ ok: boolean; session: any }>(
    "/api/preview/start",
    {
      method: "POST",
      body: JSON.stringify({ files }),
    }
  );

  return data.session;
}

export async function getPreview(id: string) {
  return request<any>(`/api/preview/${id}`);
}

export async function stopPreview(id: string) {
  const data = await request<{ ok: boolean; session: any }>(
    `/api/preview/${id}`,
    {
      method: "DELETE",
    }
  );

  return data.session;
}

export async function getProjectMemory(projectId: string) {
  const data = await request<{ ok: boolean; memory: any }>(
    `/api/memory/${projectId}`
  );

  return data.memory;
}

export async function addProjectMemory(params: {
  projectId: string;
  type?: string;
  content: unknown;
}) {
  const data = await request<{ ok: boolean; row: any }>(
    `/api/memory/${params.projectId}`,
    {
      method: "POST",
      body: JSON.stringify({
        type: params.type || "general",
        content: params.content,
      }),
    }
  );

  return data.row;
}

export async function resetProjectMemory(projectId: string) {
  const data = await request<{ ok: boolean; projectId?: string; memory?: any }>(
    `/api/memory/${projectId}`,
    {
      method: "DELETE",
    }
  );

  return data;
}

export async function createAutonomousJob(params: {
  prompt: string;
  target?: string;
}) {
  const data = await request<{
    ok: boolean;
    jobId: string;
    job?: AutonomousJob;
  }>("/api/jobs/create", {
    method: "POST",
    body: JSON.stringify({
      prompt: params.prompt,
      target: params.target,
    }),
  });

  return data;
}

export async function startRealAutonomousJob(params: {
  prompt: string;
  target?: string;
}) {
  return request<{
    ok: boolean;
    jobId: string;
    job: AutonomousJob;
    error?: string;
  }>("/api/jobs/autonomous", {
    method: "POST",
    body: JSON.stringify({
      prompt: params.prompt,
      target: params.target,
    }),
  });
}

export async function listAutonomousJobs() {
  const data = await request<{
    ok: boolean;
    jobs: AutonomousJob[];
  }>("/api/jobs");

  return data.jobs;
}

export async function getAutonomousJob(jobId: string) {
  return request<AutonomousJob>(`/api/jobs/${jobId}`);
}

export async function runAutonomousJobStep(jobId: string) {
  const data = await request<{
    ok: boolean;
    job: AutonomousJob;
  }>(`/api/jobs/${jobId}/step`, {
    method: "POST",
  });

  return data.job;
}

export async function resumeAutonomousJob(jobId: string) {
  const data = await request<{
    ok: boolean;
    job: AutonomousJob;
  }>(`/api/jobs/${jobId}/resume`, {
    method: "POST",
  });

  return data.job;
}

export async function getAutonomousJobFiles(jobId: string) {
  const data = await request<{
    ok: boolean;
    jobId: string;
    files: VirtualFile[];
    phase: string;
    score: number;
    status: string;
  }>(`/api/jobs/${jobId}/files`);

  return data;
}

export async function getAutonomousJobZipFiles(jobId: string) {
  const data = await request<{
    ok: boolean;
    jobId: string;
    files: VirtualFile[];
    phase: string;
    score: number;
    status: string;
  }>(`/api/jobs/${jobId}/files`);

  return data.files;
}

export async function getAutonomousJobReport(jobId: string) {
  const data = await request<{
    ok: boolean;
    report: any;
  }>(`/api/jobs/${jobId}/report`);

  return data.report;
}

export async function getDiagnostics() {
  return request<any>("/api/diagnostics");
}

export async function getLiveDiagnostics() {
  return request<any>("/api/diagnostics/live");
}

export async function testGitHubAccess(params: {
  repo: string;
  branch?: string;
}) {
  const search = new URLSearchParams({
    repo: params.repo,
    branch: params.branch || "main",
  });

  return request<any>(`/api/diagnostics/github?${search.toString()}`);
}

export async function exportToGitHub(params: {
  repo: string;
  branch?: string;
  commitMessage?: string;
  files: VirtualFile[];
}) {
  return request<GitHubExportResponse>("/api/github/export", {
    method: "POST",
    body: JSON.stringify({
      repo: params.repo,
      branch: params.branch || "main",
      commitMessage: params.commitMessage || "AutoApp autonomous export",
      files: params.files,
    }),
  });
}

export async function testGitHubExport(params: {
  repo: string;
  branch?: string;
}) {
  return request<{
    ok: boolean;
    test: string;
    result: GitHubExportResponse;
    error?: string;
  }>("/api/github/test-export", {
    method: "POST",
    body: JSON.stringify({
      repo: params.repo,
      branch: params.branch || "main",
    }),
  });
}

export async function getLatestGitHubCommit(params: {
  repo: string;
  branch?: string;
}) {
  const search = new URLSearchParams({
    repo: params.repo,
    branch: params.branch || "main",
  });

  return request<{
    ok: boolean;
    repo: string;
    branch: string;
    sha: string;
    commitUrl: string;
    error?: string;
  }>(`/api/github/latest?${search.toString()}`);
}

export async function getGitHubFileStatus(params: {
  repo: string;
  branch?: string;
  path: string;
}) {
  const search = new URLSearchParams({
    repo: params.repo,
    branch: params.branch || "main",
    path: params.path,
  });

  return request<{
    ok: boolean;
    repo: string;
    branch: string;
    path: string;
    sha: string;
    size: number;
    htmlUrl: string;
    downloadUrl: string;
    type: string;
    error?: string;
  }>(`/api/github/file?${search.toString()}`);
  }
