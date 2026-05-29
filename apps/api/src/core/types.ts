export type Env = {
  DB?: D1Database;
  GEMINI_API_KEY?: string;
  GROQ_API_KEY?: string;
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;
  GITHUB_TOKEN?: string;
  DEFAULT_AI_PROVIDER?: string;
  DEFAULT_GEMINI_MODEL?: string;
  DEFAULT_GROQ_MODEL?: string;
  DEFAULT_OPENAI_MODEL?: string;
};

export type VirtualFile = {
  path: string;
  content: string | null;
};

export type AiProvider = "groq" | "gemini" | "openai";

export type AiConfig = {
  provider?: AiProvider | string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
};

export type BuildMode = "none" | "virtual" | "real";

export type MemoryJob = {
  id: string;
  status: "queued" | "running" | "success" | "error";
  createdAt: number;
  updatedAt: number;
  logs: string[];
  result?: unknown;
  error?: string;
};

export type PersistentJobStatus = "running" | "paused" | "done" | "error";

export type PersistentJob = {
  id: string;
  prompt: string;
  status: PersistentJobStatus | string;
  phase: string;
  target: string;
  score: number;
  attempts: number;
  max_attempts: number;
  files_json: string;
  logs_json: string;
  error?: string | null;
  created_at: number;
  updated_at: number;
  next_run_at: number;
  last_score?: number;
  stagnant_steps?: number;
  strategy?: string;
};
