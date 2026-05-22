import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { BuildIssue } from "../sandbox/errorParser";

export type ProjectMemory = {
  projectId: string;
  createdAt: number;
  updatedAt: number;

  framework?: string;
  language?: string;

  architectureNotes: string[];
  codingStyle: string[];
  recurringProblems: string[];
  successfulFixes: string[];
  preferredLibraries: string[];
  rejectedPatterns: string[];

  buildHistory: {
    success: boolean;
    timestamp: number;
    issues: BuildIssue[];
  }[];

  aiDecisions: {
    timestamp: number;
    type: string;
    summary: string;
  }[];
};

const MEMORY_DIR = path.join(process.cwd(), ".forge-memory");

export async function loadProjectMemory(
  projectId: string
): Promise<ProjectMemory> {
  await mkdir(MEMORY_DIR, { recursive: true });

  const filePath = getMemoryPath(projectId);

  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return createEmptyMemory(projectId);
  }
}

export async function saveProjectMemory(memory: ProjectMemory) {
  await mkdir(MEMORY_DIR, { recursive: true });

  memory.updatedAt = Date.now();

  await writeFile(
    getMemoryPath(memory.projectId),
    JSON.stringify(memory, null, 2),
    "utf8"
  );

  return memory;
}

export async function registerBuildResult(params: {
  memory: ProjectMemory;
  success: boolean;
  issues: BuildIssue[];
}) {
  params.memory.buildHistory.unshift({
    success: params.success,
    timestamp: Date.now(),
    issues: params.issues.slice(0, 20),
  });

  params.memory.buildHistory = params.memory.buildHistory.slice(0, 40);

  if (!params.success) {
    const recurring = params.issues
      .map((issue) => simplifyIssue(issue))
      .filter(Boolean);

    params.memory.recurringProblems = unique([
      ...recurring,
      ...params.memory.recurringProblems,
    ]).slice(0, 40);
  }

  await saveProjectMemory(params.memory);

  return params.memory;
}

export async function registerSuccessfulFix(
  memory: ProjectMemory,
  fix: string
) {
  memory.successfulFixes = unique([
    fix,
    ...memory.successfulFixes,
  ]).slice(0, 40);

  await saveProjectMemory(memory);

  return memory;
}

export async function registerAiDecision(params: {
  memory: ProjectMemory;
  type: string;
  summary: string;
}) {
  params.memory.aiDecisions.unshift({
    timestamp: Date.now(),
    type: params.type,
    summary: params.summary,
  });

  params.memory.aiDecisions = params.memory.aiDecisions.slice(0, 60);

  await saveProjectMemory(params.memory);

  return params.memory;
}

export async function registerArchitectureNotes(
  memory: ProjectMemory,
  notes: string[]
) {
  memory.architectureNotes = unique([
    ...notes,
    ...memory.architectureNotes,
  ]).slice(0, 50);

  await saveProjectMemory(memory);

  return memory;
}

export async function registerPreferredLibraries(
  memory: ProjectMemory,
  libraries: string[]
) {
  memory.preferredLibraries = unique([
    ...libraries,
    ...memory.preferredLibraries,
  ]).slice(0, 50);

  await saveProjectMemory(memory);

  return memory;
}

export async function registerRejectedPatterns(
  memory: ProjectMemory,
  patterns: string[]
) {
  memory.rejectedPatterns = unique([
    ...patterns,
    ...memory.rejectedPatterns,
  ]).slice(0, 40);

  await saveProjectMemory(memory);

  return memory;
}

export function compactMemory(memory: ProjectMemory) {
  return JSON.stringify(
    {
      framework: memory.framework,
      language: memory.language,
      architectureNotes: memory.architectureNotes.slice(0, 15),
      codingStyle: memory.codingStyle.slice(0, 10),
      recurringProblems: memory.recurringProblems.slice(0, 15),
      successfulFixes: memory.successfulFixes.slice(0, 15),
      preferredLibraries: memory.preferredLibraries.slice(0, 15),
      rejectedPatterns: memory.rejectedPatterns.slice(0, 15),
      recentBuilds: memory.buildHistory.slice(0, 8).map((build) => ({
        success: build.success,
        issues: build.issues.slice(0, 5),
      })),
      recentDecisions: memory.aiDecisions.slice(0, 10),
    },
    null,
    2
  );
}

function simplifyIssue(issue: BuildIssue) {
  if (issue.code) return `${issue.type}:${issue.code}`;
  if (issue.message) return `${issue.type}:${issue.message.slice(0, 120)}`;
  return null;
}

function getMemoryPath(projectId: string) {
  return path.join(MEMORY_DIR, `${sanitize(projectId)}.json`);
}

function sanitize(value: string) {
  return value.replace(/[^a-zA-Z0-9-_]/g, "_");
}

function createEmptyMemory(projectId: string): ProjectMemory {
  return {
    projectId,
    createdAt: Date.now(),
    updatedAt: Date.now(),

    architectureNotes: [],
    codingStyle: [],
    recurringProblems: [],
    successfulFixes: [],
    preferredLibraries: [],
    rejectedPatterns: [],

    buildHistory: [],
    aiDecisions: [],
  };
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
    }
