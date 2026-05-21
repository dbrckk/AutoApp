export type JobStatus = "queued" | "running" | "success" | "error";

export type GenerationJob = {
  id: string;
  status: JobStatus;
  createdAt: number;
  updatedAt: number;
  logs: string[];
  result?: unknown;
  error?: string;
};

const jobs = new Map<string, GenerationJob>();

export function createJob() {
  const id = crypto.randomUUID();

  const job: GenerationJob = {
    id,
    status: "queued",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    logs: ["Job queued."],
  };

  jobs.set(id, job);
  return job;
}

export function getJob(id: string) {
  return jobs.get(id);
}

export function updateJob(id: string, patch: Partial<GenerationJob>) {
  const job = jobs.get(id);
  if (!job) return null;

  const next = {
    ...job,
    ...patch,
    updatedAt: Date.now(),
  };

  jobs.set(id, next);
  return next;
}

export function pushJobLog(id: string, message: string) {
  const job = jobs.get(id);
  if (!job) return null;

  const next = {
    ...job,
    logs: [`${new Date().toLocaleTimeString()} · ${message}`, ...job.logs].slice(0, 100),
    updatedAt: Date.now(),
  };

  jobs.set(id, next);
  return next;
}

export function cleanupOldJobs(maxAgeMs = 1000 * 60 * 60) {
  const now = Date.now();

  for (const [id, job] of jobs.entries()) {
    if (now - job.updatedAt > maxAgeMs) {
      jobs.delete(id);
    }
  }
    }
