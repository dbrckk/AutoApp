import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { VirtualFile } from "../types";

import { exportFilesAsZip } from "../lib/exportZip";

import {

deleteSnapshot,

listSnapshots,

saveSnapshot,

type ProjectSnapshot,

} from "../lib/snapshots";

import {

applyTemplate,

checkApiHealth,

checkBuild,

createDeploymentPack,

createPublishReport,

exportToGitHub,

generateProject,

getAutonomousJobFiles,

getAutonomousJobLogs,

getDiagnostics,

getGitHubFileStatus,

getGitHubHistory,

getLatestGitHubCommit,

getLiveDiagnostics,

improveAutonomousJob,

inspectProject,

listAutonomousJobs,

listTemplates,

resolveDependencies,

resumeAutonomousJob,

runAutonomousJobStep,

scoreProject,

startRealAutonomousJob,

testGeminiApi,

testGitHubAccess,

testGitHubExport,

type AutonomousJob,

} from "../lib/api";

const SAMPLE_PROMPT = `Create a production-ready Android-first viral mobile game with one-touch gameplay, progression, upgrades, particles, animations, local save, missions, daily rewards, monetization hooks, premium UI and Capacitor Android export.

auto improve forever: true

github repo: dbrckk/viral-android-game

github branch: main`;

const STORAGE_KEY = "autoapp.session.v2";

type SessionState = {

prompt: string;

githubRepo: string;

githubBranch: string;

activeJobId: string;

};

export function useAutoApp() {

const session = readSession();

const [prompt, setPromptState] = useState(session.prompt || SAMPLE_PROMPT);

const [files, setFiles] = useState<VirtualFile[]>([]);

const [selectedPath, setSelectedPath] = useState("");

const [activeJobId, setActiveJobIdState] = useState(session.activeJobId || "");

const [jobs, setJobs] = useState<AutonomousJob[]>([]);

const [jobLogs, setJobLogs] = useState<string[]>([]);

const [githubHistory, setGithubHistory] = useState<any[]>([]);

const [githubRepo, setGithubRepoState] = useState(session.githubRepo || "");

const [githubBranch, setGithubBranchState] = useState(

session.githubBranch || "main"

);

const [autoRefreshJobs, setAutoRefreshJobs] = useState(true);

const [snapshots, setSnapshots] = useState<ProjectSnapshot[]>(() =>

listSnapshots()

);

const [fileActionMode, setFileActionMode] = useState<

"create" | "rename" | null

>(null);

const [fileActionValue, setFileActionValue] = useState("");

const [confirmDeleteFilePath, setConfirmDeleteFilePath] = useState("");

const [busy, setBusy] = useState(false);

const [status, setStatus] = useState("Ready.");

const [result, setResult] = useState<any>(null);

const [diagnostics, setDiagnostics] = useState<any>(null);

const actionIdRef = useRef(0);

const selectedFile = useMemo(

() => files.find((file) => file.path === selectedPath) || files[0] || null,

[files, selectedPath]

);

const activeJob = useMemo(

() => jobs.find((job) => job.id === activeJobId) || null,

[jobs, activeJobId]

);

const projectStats = useMemo(() => {

const lines = files.reduce(

(sum, file) => sum + String(file.content || "").split("\n").length,

0

);

const chars = files.reduce(

(sum, file) => sum + String(file.content || "").length,

0

);

return {

files: files.length,

lines,

chars,

jobs: jobs.length,

runningJobs: jobs.filter((job) => job.status === "running").length,

};

}, [files, jobs]);

const setPrompt = useCallback((value: string) => {

setPromptState(value);

}, []);

const setGithubRepo = useCallback((value: string) => {

setGithubRepoState(value);

}, []);

const setGithubBranch = useCallback((value: string) => {

setGithubBranchState(value);

}, []);

const setActiveJobId = useCallback((value: string) => {

setActiveJobIdState(value);

}, []);

useEffect(() => {

writeSession({

prompt,

githubRepo,

githubBranch,

activeJobId,

});

}, [prompt, githubRepo, githubBranch, activeJobId]);

function buildPromptWithGitHubTarget(rawPrompt: string) {

const repo = githubRepo.trim();

const branch = githubBranch.trim() || "main";

const lines = [rawPrompt.trim()];

if (!/auto\s*improve\s*forever\s*:\s*true/i.test(rawPrompt)) {

lines.push("", "auto improve forever: true");

}

if (repo && !/github\s*repo\s*:/i.test(rawPrompt)) {

lines.push(`github repo: ${repo}`);

}

if (repo && !/github\s*branch\s*:/i.test(rawPrompt)) {

lines.push(`github branch: ${branch}`);

}

return lines.join("\n");

}

async function runAction(label: string, action: () => Promise<any>) {

const actionId = ++actionIdRef.current;

setBusy(true);

setStatus(label);

try {

const value = await action();

if (actionId === actionIdRef.current) {

setResult(value);

setStatus("Done.");

}

return value;

} catch (error: any) {

const message = error?.message || "Action failed.";

if (actionId === actionIdRef.current) {

setStatus(message);

setResult({ ok: false, error: message });

}

return null;

} finally {

if (actionId === actionIdRef.current) {

setBusy(false);

}

}

}

const refreshJobs = useCallback(async () => {

const data = await listAutonomousJobs();

setJobs(data || []);

return data;

}, []);

const refreshJobFiles = useCallback(

async (jobId = activeJobId) => {

if (!jobId) return null;

const data = await getAutonomousJobFiles(jobId);

const nextFiles = data.files || [];

setFiles(nextFiles);

setSelectedPath((current) => {

if (nextFiles.some((file) => file.path === current)) return current;

return nextFiles[0]?.path || "";

});

return data;

},

[activeJobId]

);

const refreshJobLogs = useCallback(

async (jobId = activeJobId) => {

if (!jobId) return [];

const data = await getAutonomousJobLogs(jobId);

setJobLogs(data.logs || []);

return data.logs || [];

},

[activeJobId]

);

const refreshGitHubHistory = useCallback(async () => {

if (!githubRepo.trim()) return [];

const data = await getGitHubHistory({

repo: githubRepo.trim(),

branch: githubBranch.trim() || "main",

});

setGithubHistory(data.commits || []);

return data.commits || [];

}, [githubRepo, githubBranch]);

function refreshSnapshots() {

setSnapshots(listSnapshots());

}

function handleSaveSnapshot() {

if (!files.length) {

setStatus("No files to snapshot.");

return;

}

const snapshot = saveSnapshot(

`Snapshot ${new Date().toLocaleString()}`,

files

);

refreshSnapshots();

setResult({ ok: true, snapshot });

setStatus("Snapshot saved.");

}

function handleRestoreSnapshot(id: string) {

const snapshot = snapshots.find((item) => item.id === id);

if (!snapshot) {

setStatus("Snapshot not found.");

return;

}

setFiles(snapshot.files);

setSelectedPath(snapshot.files[0]?.path || "");

setResult({ ok: true, restored: snapshot });

setStatus(`Snapshot restored: ${snapshot.name}`);

}

function handleDeleteSnapshot(id: string) {

setSnapshots(deleteSnapshot(id));

setStatus("Snapshot deleted.");

}

async function handleGenerate() {

await runAction("Generating project...", async () => {

const response = await generateProject({

prompt: buildPromptWithGitHubTarget(prompt),

currentFiles: files,

buildMode: "virtual",

});

const nextFiles = mergeFiles(files, response.files || []);

setFiles(nextFiles);

setSelectedPath(nextFiles[0]?.path || "");

return response;

});

}

async function handleStartAutonomous() {

await runAction("Starting autonomous project...", async () => {

const response = await startRealAutonomousJob({

prompt: buildPromptWithGitHubTarget(prompt),

});

if (!response.ok) {

throw new Error(response.error || "Autonomous job failed.");

}

setActiveJobId(response.jobId);

await Promise.allSettled([refreshJobs(), refreshJobFiles(response.jobId)]);

await refreshJobLogs(response.jobId).catch(() => []);

return response;

});

}

async function handleStepJob() {

if (!activeJobId) {

setStatus("No active project selected.");

return;

}

await runAction("Running one autonomous step...", async () => {

const job = await runAutonomousJobStep(activeJobId);

await Promise.allSettled([

refreshJobFiles(activeJobId),

refreshJobLogs(activeJobId),

refreshJobs(),

]);

return job;

});

}

async function handleResumeJob() {

if (!activeJobId) {

setStatus("No active project selected.");

return;

}

await runAction("Resuming project...", async () => {

const job = await resumeAutonomousJob(activeJobId);

await Promise.allSettled([refreshJobs(), refreshJobLogs(activeJobId)]);

return job;

});

}

async function handleImproveJob(jobId = activeJobId) {

if (!jobId) {

setStatus("No project selected.");

return;

}

await runAction("Relaunching infinite improvement...", async () => {

const job = await improveAutonomousJob(jobId);

setActiveJobId(job.id);

await Promise.allSettled([

refreshJobs(),

refreshJobFiles(job.id),

refreshJobLogs(job.id),

]);

return job;

});

}

async function handleOpenJob(jobId: string) {

setActiveJobId(jobId);

await runAction("Opening project...", async () => {

const [filesResult, logsResult] = await Promise.allSettled([

refreshJobFiles(jobId),

refreshJobLogs(jobId),

]);

return {

ok: true,

files:

filesResult.status === "fulfilled" ? filesResult.value?.files || [] : [],

logs: logsResult.status === "fulfilled" ? logsResult.value : [],

};

});

}

async function handleExportGitHub() {

if (!githubRepo.trim()) {

setStatus("Missing GitHub repo. Example: owner/repo");

return;

}

if (!files.length) {

setStatus("No files to export.");

return;

}

await runAction("Exporting current files to GitHub...", async () => {

const response = await exportToGitHub({

repo: githubRepo.trim(),

branch: githubBranch.trim() || "main",

commitMessage: "AutoApp manual export",

files,

});

await refreshGitHubHistory().catch(() => []);

return response;

});

}

async function handleExportZip() {

if (!files.length) {

setStatus("No files to export.");

return;

}

await runAction("Exporting ZIP...", async () => {

await exportFilesAsZip(files, "autoapp-project");

return {

ok: true,

exported: files.length,

format: "zip",

};

});

}

async function handleGitHubAccessTest() {

if (!githubRepo.trim()) {

setStatus("Missing GitHub repo.");

return;

}

await runAction("Testing GitHub access...", async () =>

testGitHubAccess({

repo: githubRepo.trim(),

branch: githubBranch.trim() || "main",

})

);

}

async function handleGitHubWriteTest() {

if (!githubRepo.trim()) {

setStatus("Missing GitHub repo.");

return;

}

await runAction("Writing real test file to GitHub...", async () => {

const response = await testGitHubExport({

repo: githubRepo.trim(),

branch: githubBranch.trim() || "main",

});

await refreshGitHubHistory().catch(() => []);

return response;

});

}

async function handleLatestCommit() {

if (!githubRepo.trim()) {

setStatus("Missing GitHub repo.");

return;

}

await runAction("Checking latest GitHub commit...", async () =>

getLatestGitHubCommit({

repo: githubRepo.trim(),

branch: githubBranch.trim() || "main",

})

);

}

async function handleCheckTestFile() {

if (!githubRepo.trim()) {

setStatus("Missing GitHub repo.");

return;

}

await runAction("Checking .autoapp-test.json...", async () =>

getGitHubFileStatus({

repo: githubRepo.trim(),

branch: githubBranch.trim() || "main",

path: ".autoapp-test.json",

})

);

}

async function handleDiagnostics() {

await runAction("Running diagnostics...", async () => {

const data = await getDiagnostics();

setDiagnostics(data);

return data;

});

}

async function handleLiveDiagnostics() {

await runAction("Running live diagnostics...", async () => {

const data = await getLiveDiagnostics();

setDiagnostics(data);

return data;

});

}

async function handleUtility(action: string) {

await runAction(action, async () => {

if (action === "Health") return checkApiHealth();

if (action === "AI Test") return testGeminiApi();

if (action === "Build Check") return checkBuild({ files });

if (action === "Score") return scoreProject(files);

if (action === "Inspect") return inspectProject(files);

if (action === "Resolve Dependencies") {

const data = await resolveDependencies({ files, apply: true });

if (data.files) {

setFiles(data.files);

setSelectedPath(data.files[0]?.path || "");

}

return data;

}

if (action === "Deployment Pack") {

const extra = await createDeploymentPack(files);

const nextFiles = mergeFiles(files, extra);

setFiles(nextFiles);

setSelectedPath(nextFiles[0]?.path || "");

return extra;

}

if (action === "Publish Report") return createPublishReport(files);

return null;

});

}

async function handleLoadTemplates() {

await runAction("Loading templates...", async () => listTemplates());

}

async function handleApplyTemplate(id: string) {

await runAction("Applying template...", async () => {

const template = await applyTemplate(id);

const templateFiles = Array.isArray(template?.files) ? template.files : [];

setFiles(templateFiles);

setSelectedPath(templateFiles[0]?.path || "");

return template || { ok: false, error: "Template returned null." };

});

}

function handleCreateFile() {

setFileActionValue("/src/new-file.ts");

setFileActionMode("create");

}

function handleRenameSelectedFile() {

if (!selectedFile) {

setStatus("No file selected.");

return;

}

setFileActionValue(selectedFile.path);

setFileActionMode("rename");

}

function handleDeleteSelectedFile() {

if (!selectedFile) {

setStatus("No file selected.");

return;

}

setConfirmDeleteFilePath(selectedFile.path);

}

function handleCancelDeleteFile() {

setConfirmDeleteFilePath("");

}

function handleConfirmDeleteSelectedFile() {

if (!confirmDeleteFilePath) return;

const fileToDelete = files.find((file) => file.path === confirmDeleteFilePath);

if (!fileToDelete) {

setStatus("File not found.");

setConfirmDeleteFilePath("");

return;

}

handleSaveSnapshot();

const nextFiles = files.filter((file) => file.path !== fileToDelete.path);

setFiles(nextFiles);

setSelectedPath(nextFiles[0]?.path || "");

setStatus(`File deleted: ${fileToDelete.path}`);

setConfirmDeleteFilePath("");

}

function handleCancelFileAction() {

setFileActionMode(null);

setFileActionValue("");

}

function handleConfirmFileAction() {

const normalized = normalizePath(fileActionValue);

if (!fileActionMode || !normalized.trim()) {

handleCancelFileAction();

return;

}

if (fileActionMode === "create") {

if (files.some((file) => normalizePath(file.path) === normalized)) {

setStatus("File already exists.");

return;

}

const nextFiles = [

...files,

{ path: normalized, content: "" },

].sort((a, b) => a.path.localeCompare(b.path));

setFiles(nextFiles);

setSelectedPath(normalized);

setStatus(`File created: ${normalized}`);

handleCancelFileAction();

return;

}

if (fileActionMode === "rename") {

if (!selectedFile) {

setStatus("No file selected.");

handleCancelFileAction();

return;

}

if (

files.some(

(file) =>

file.path !== selectedFile.path &&

normalizePath(file.path) === normalized

)

) {

setStatus("A file already exists with this path.");

return;

}

const nextFiles = files

.map((file) =>

file.path === selectedFile.path ? { ...file, path: normalized } : file

)

.sort((a, b) => a.path.localeCompare(b.path));

setFiles(nextFiles);

setSelectedPath(normalized);

setStatus(`File renamed: ${normalized}`);

handleCancelFileAction();

}

}

useEffect(() => {

refreshJobs().catch(() => undefined);

}, [refreshJobs]);

useEffect(() => {

if (!autoRefreshJobs) return;

const timer = window.setInterval(() => {

refreshJobs().catch(() => undefined);

if (activeJobId) {

refreshJobFiles(activeJobId).catch(() => undefined);

refreshJobLogs(activeJobId).catch(() => undefined);

}

}, document.visibilityState === "visible" ? 12_000 : 30_000);

return () => window.clearInterval(timer);

}, [autoRefreshJobs, activeJobId, refreshJobs, refreshJobFiles, refreshJobLogs]);

return {

prompt,

setPrompt,

files,

setFiles,

selectedPath,

setSelectedPath,

selectedFile,

activeJobId,

activeJob,

setActiveJobId,

jobs,

jobLogs,

refreshJobs,

refreshJobFiles,

refreshJobLogs,

handleOpenJob,

handleImproveJob,

githubRepo,

setGithubRepo,

githubBranch,

setGithubBranch,

githubHistory,

refreshGitHubHistory,

autoRefreshJobs,

setAutoRefreshJobs,

snapshots,

handleSaveSnapshot,

handleRestoreSnapshot,

handleDeleteSnapshot,

fileActionMode,

fileActionValue,

setFileActionValue,

handleCancelFileAction,

handleConfirmFileAction,

confirmDeleteFilePath,

handleCancelDeleteFile,

handleConfirmDeleteSelectedFile,

busy,

status,

result,

diagnostics,

projectStats,

handleGenerate,

handleStartAutonomous,

handleStepJob,

handleResumeJob,

handleExportGitHub,

handleExportZip,

handleGitHubAccessTest,

handleGitHubWriteTest,

handleLatestCommit,

handleCheckTestFile,

handleDiagnostics,

handleLiveDiagnostics,

handleUtility,

handleLoadTemplates,

handleApplyTemplate,

handleCreateFile,

handleDeleteSelectedFile,

handleRenameSelectedFile,

};

}

function mergeFiles(currentFiles: VirtualFile[], changedFiles: VirtualFile[]) {

const map = new Map<string, VirtualFile>();

for (const file of currentFiles || []) {

map.set(normalizePath(file.path), {

path: normalizePath(file.path),

content: file.content,

});

}

for (const file of changedFiles || []) {

const path = normalizePath(file.path);

if (file.content === null) {

map.delete(path);

} else {

map.set(path, {

path,

content: file.content,

});

}

}

return Array.from(map.values()).sort((a, b) => a.path.localeCompare(b.path));

}

function normalizePath(path: string) {

const value = String(path || "").trim();

return value.startsWith("/") ? value : `/${value}`;

}

function readSession(): SessionState {

try {

return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");

} catch {

return {

prompt: "",

githubRepo: "",

githubBranch: "main",

activeJobId: "",

};

}

}

function writeSession(state: SessionState) {

try {

localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

} catch {

// Ignore private mode storage failures.

}

}

export type AutoAppState = ReturnType<typeof useAutoApp>;
