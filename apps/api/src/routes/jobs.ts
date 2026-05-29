export type JobStatus = "running" | "paused" | "done" | "error";

export type JobPhase =

| "product_spec"

| "architecture"

| "core_features"

| "ui_system"

| "gameplay_or_business_logic"

| "sprites_and_assets"

| "animations_and_feedback"

| "repair"

| "launch_pack"

| "final_packaging"

| "final_audit"

| "done";

export type JobStrategy =

| "normal"

| "repair"

| "force_product_depth"

| "force_ui"

| "force_mobile"

| "force_reliability"

| "force_assets"

| "force_feedback"

| "force_seo"

| "finalize";

export type Job = {

id: string;

prompt: string;

status: JobStatus;

phase: JobPhase | string;

target: string;

score: number;

attempts: number;

max_attempts: number;

error?: string;

created_at: number;

updated_at: number;

next_run_at: number;

last_score?: number;

stagnant_steps?: number;

strategy?: JobStrategy | string;

infinite?: boolean;

};

export type JobFilesResponse = {

ok: boolean;

jobId: string;

files: Array<{

path: string;

content: string;

}>;

phase: string;

score: number;

status: JobStatus | string;

error?: string;

};

export type JobReportResponse = {

ok: boolean;

report: unknown;

error?: string;

};

export type JobLogsResponse = {

ok: boolean;

jobId: string;

logs: string[];

error?: string;

};

export function isRunningJob(job: Job) {

return job.status === "running";

}

export function isFinishedJob(job: Job) {

return job.status === "done";

}

export function isInfiniteJob(job: Job) {

return Boolean(job.infinite) || /auto\s*improve\s*forever\s*:\s*true/i.test(job.prompt || "");

}

export function getJobAgeLabel(job: Job) {

const updatedAt = Number(job.updated_at || job.created_at || 0);

if (!updatedAt) return "unknown";

const deltaMs = Date.now() - updatedAt;

const minutes = Math.max(0, Math.floor(deltaMs / 60_000));

if (minutes < 1) return "just now";

if (minutes < 60) return `${minutes}m ago`;

const hours = Math.floor(minutes / 60);

if (hours < 24) return `${hours}h ago`;

const days = Math.floor(hours / 24);

return `${days}d ago`;

}

export function getJobProgressPercent(job: Job) {

const max = Math.max(1, Number(job.max_attempts || 1));

const attempts = Math.max(0, Number(job.attempts || 0));

if (isInfiniteJob(job)) {

return Math.min(100, Math.max(5, Number(job.score || 0)));

}

return Math.min(100, Math.round((attempts / max) * 100));

  }
