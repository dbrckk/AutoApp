export type VirtualFile = {
  path: string;
  content: string | null;
};

export type AiConfig = {
  provider?: "gemini" | "openai" | string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
};

export type GenerateInput = {
  prompt: string;
  currentFiles: VirtualFile[];
  isAutoImprove?: boolean;
  aiConfig?: AiConfig;
};

export type GenerateOutput = {
  files: VirtualFile[];
  changelog: string;
  estimatedTimeSaved: string;
  score: ProjectScore;
  nextActions: string[];
  mode: "create" | "improve" | "repair";
};

export type ProjectScore = {
  ui: number;
  mobile: number;
  performance: number;
  accessibility: number;
  seo: number;
  maintainability: number;
  architecture: number;
  monetization: number;
  reliability: number;
  total: number;
};

export type AgentResult = {
  summary: string;
  issues: string[];
  recommendations: string[];
};

export type AiCaller = (prompt: string) => Promise<{
  text: string;
  raw?: unknown;
}>;
