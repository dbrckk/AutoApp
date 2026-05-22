import type { GenerationResponse, VirtualFile } from "../types";

export type BuildMode = "none" | "virtual" | "real";

export type AiConfig = {
  provider?: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
};

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || `Request failed: ${response.status}`);
  }

  return data as T;
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
    headers: { "Content-Type": "application/json" },
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
  const data = await request<{ ok: boolean; jobId: string }>("/api/generate-job", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectId: params.projectId,
      prompt: params.prompt,
      currentFiles: params.currentFiles,
      isAutoImprove: Boolean(params.isAutoImprove),
      aiConfig: params.aiConfig,
      buildMode: params.buildMode || "virtual",
    }),
  });

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
  const data = await request<{ ok: boolean; jobId: string }>("/api/autopilot/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectId: params.projectId,
      prompt: params.prompt,
      files: params.files,
      aiConfig: params.aiConfig,
      buildMode: params.buildMode || "virtual",
      targetScore: params.targetScore || 90,
      maxIterations: params.maxIterations || 5,
    }),
  });

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
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      files: params.files,
      mode: params.mode || "virtual",
    }),
  });
}

export async function scoreProject(files: VirtualFile[]) {
  const data = await request<{ ok: boolean; score: any }>("/api/score", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ files }),
  });

  return data.score;
}

export async function inspectProject(files: VirtualFile[]) {
  const data = await request<{ ok: boolean; inspection: any }>("/api/inspect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
    headers: { "Content-Type": "application/json" },
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
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ files }),
  });

  return data.files;
}

export async function createPublishReport(files: VirtualFile[]) {
  const data = await request<{ ok: boolean; report: any }>("/api/publish/report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ files }),
  });

  return data.report;
}

export async function listTemplates() {
  const data = await request<{ ok: boolean; templates: any[] }>("/api/templates");
  return data.templates;
}

export async function applyTemplate(id: string) {
  const data = await request<{ ok: boolean; template: any }>("/api/templates/apply", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });

  return data.template;
}

export async function startPreview(files: VirtualFile[]) {
  const data = await request<{ ok: boolean; session: any }>("/api/preview/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ files }),
  });

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

export async function resetProjectMemory(projectId: string) {
  const data = await request<{ ok: boolean; memory: any }>(
    `/api/memory/${projectId}`,
    {
      method: "DELETE",
    }
  );

  return data.memory;
}
