import type { VirtualFile } from "../core/types";

export type AgentContext = {
  userPrompt: string;
  target: string;
  files: VirtualFile[];
  build: any;
  score: any;
  phase?: string;
  strategy?: string;
};

export type AgentOutput = {
  files: VirtualFile[];
  changelog: string;
  estimatedTimeSaved?: string;
  notes?: string[];
};

export type AgentRole =
  | "planner"
  | "architect"
  | "frontend"
  | "gameplay"
  | "mobile"
  | "repair"
  | "reviewer"
  | "packager";

export type AgentDefinition = {
  role: AgentRole;
  name: string;
  mission: string;
  systemPrompt: string;
};
