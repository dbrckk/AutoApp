export interface VirtualFile {
  path: string;
  content: string;
}

export interface Commit {
  id: string;
  timestamp: number;
  message: string;
  prompt: string;
  files: VirtualFile[];
  changelog: string;
  estimatedTimeSaved: string;
}

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  commits: Commit[];
}

export interface GenerationResponse {
  files: VirtualFile[];
  changelog: string;
  estimatedTimeSaved: string;
}

export interface ProjectScore {
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
}

export interface GenerationResponse {
  files: VirtualFile[];
  changelog: string;
  estimatedTimeSaved: string;
  score?: ProjectScore;
  nextActions?: string[];
  mode?: "create" | "improve" | "repair";
}
