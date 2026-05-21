import type { GenerationResponse, VirtualFile } from "../types";

export type BuildMode = "none" | "virtual" | "real";

export type AiConfig = {
  provider?: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
};

export async function generateProject(params: {
  prompt: string;
  currentFiles: VirtualFile[];
  isAutoImprove?: boolean;
  aiConfig?: AiConfig;
  buildMode?: BuildMode;
}): Promise<GenerationResponse> {
  const response = await fetch("/api/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: params.prompt,
      currentFiles: params.currentFiles,
      isAutoImprove: Boolean(params.isAutoImprove),
      aiConfig: params.aiConfig,
      buildMode: params.buildMode || "virtual",
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error || "Generation failed");
  }

  return data;
}

export async function checkBuild(params: {
  files: VirtualFile[];
  mode?: BuildMode;
}) {
  const response = await fetch("/api/build-check", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      files: params.files,
      mode: params.mode || "virtual",
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error || "Build check failed");
  }

  return data;
}

export async function scoreProject(files: VirtualFile[]) {
  const response = await fetch("/api/score", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ files }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error || "Score failed");
  }

  return data.score;
                    }
