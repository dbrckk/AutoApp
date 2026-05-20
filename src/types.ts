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
