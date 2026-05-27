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
  content: string;
};

export type FileOperation = {
  type: "create" | "update" | "delete";
  path: string;
  content?: string;
};

export type AiProvider =
  | "groq"
  | "gemini"
  | "openai";

export type AiConfig = {
  provider?: AiProvider;

  apiKey?: string;

  baseUrl?: string;

  model?: string;

  temperature?: number;

  maxTokens?: number;
};

export type BuildMode =
  | "none"
  | "virtual"
  | "real";

export type BuildCheckResult = {
  ok: boolean;

  errors: string[];

  warnings: string[];

  missingImports: string[];

  missingDependencies: string[];

  invalidFiles: string[];

  checkedAt: number;
};

export type ProjectInspection = {
  risks: string[];

  strengths: string[];

  missingCriticalFiles: string[];

  duplicateFiles: string[];

  emptyFiles: string[];

  suspiciousPatterns: string[];
};

export type ScoreBreakdown = {
  total: number;

  architecture: number;

  ui: number;

  mobile: number;

  reliability: number;

  productDepth: number;

  completeness: number;

  productionReadiness: number;
};

export type AutonomousPhase =
  | "product_spec"
  | "architecture"
  | "core_features"
  | "ui_system"
  | "animations_and_feedback"
  | "sprites_and_assets"
  | "repair"
  | "final_packaging"
  | "done";

export type PersistentJobStatus =
  | "running"
  | "paused"
  | "done"
  | "error";

export type PersistentJob = {
  id: string;

  prompt: string;

  status: PersistentJobStatus;

  phase: AutonomousPhase;

  target: string;

  score: number;

  attempts: number;

  max_attempts: number;

  files_json: string;

  logs_json: string;

  error?: string;

  created_at: number;

  updated_at: number;

  next_run_at: number;

  last_score?: number;

  stagnant_steps?: number;

  strategy?: string;
};

export type GenerationRequest = {
  projectId?: string;

  prompt: string;

  currentFiles: VirtualFile[];

  isAutoImprove?: boolean;

  aiConfig?: AiConfig;

  buildMode?: BuildMode;
};

export type GenerationResponse = {
  ok: boolean;

  files: VirtualFile[];

  summary?: string;

  score?: ScoreBreakdown;

  build?: BuildCheckResult;

  inspection?: ProjectInspection;

  warnings?: string[];

  errors?: string[];
};

export type AgentRole =
  | "planner"
  | "architect"
  | "frontend"
  | "backend"
  | "designer"
  | "mobile"
  | "gameplay"
  | "repair"
  | "optimizer"
  | "security";

export type AgentDefinition = {
  role: AgentRole;

  name: string;

  systemPrompt: string;

  temperature?: number;

  preferredModel?: string;
};

export type AgentRunInput = {
  env: Env;

  aiConfig?: AiConfig;

  userPrompt: string;

  files: VirtualFile[];

  target: string;

  roles: AgentRole[];

  phase: AutonomousPhase;
};

export type AgentRunResult = {
  files: VirtualFile[];

  rawOutputs: {
    role: AgentRole;
    output: string;
  }[];

  logs: string[];
};

export type DependencyResolutionResult = {
  packageJson: VirtualFile | null;

  addedDependencies: string[];

  addedDevDependencies: string[];

  warnings: string[];
};

export type TemplateDefinition = {
  id: string;

  name: string;

  description: string;

  tags: string[];

  files?: VirtualFile[];
};

export type DeploymentPackResult = {
  files: VirtualFile[];

  count: number;
};

export type PublishReport = {
  ready: boolean;

  score: number;

  qualityScore: number;

  blockers: string[];

  warnings: string[];

  realStatus: {
    staticInspection: boolean;

    realNpmBuild: boolean;

    realPreview: boolean;

    realGitHubExportAvailable: boolean;

    realDeploymentBuildRequires: string;
  };

  checklist: string[];

  commands: string[];
};

export type ProjectMemoryRow = {
  id: string;

  project_id: string;

  type: string;

  content_json: string;

  created_at: number;
};

export type GitHubExportResult = {
  ok: boolean;

  repo: string;

  branch: string;

  commitSha: string;

  commitUrl: string;
};

export type DiagnosticsResult = {
  ok: boolean;

  service: string;

  runtime: string;

  timestamp: number;

  realCapabilities: Record<
    string,
    string
  >;

  checks: Record<string, unknown>;
};
