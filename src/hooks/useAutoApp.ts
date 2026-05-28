import { useEffect, useMemo, useState } from "react";

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

getDiagnostics,

getGitHubFileStatus,

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

const SAMPLE_PROMPT = `Create a complete premium mobile-first SaaS dashboard for creators.

It must include onboarding, dashboard, analytics, settings, export actions, beautiful UI, empty/loading/error states.`;

export function useAutoApp() {

const [prompt, setPrompt] = useState(SAMPLE_PROMPT);

const [files, setFiles] = useState<VirtualFile[]>([]);

const [selectedPath, setSelectedPath] = useState("");

const [activeJobId, setActiveJobId] = useState("");

const [jobs, setJobs] = useState<AutonomousJob[]>([]);

const [githubRepo, setGithubRepo] = useState("");

const [githubBranch, setGithubBranch] = useState("main");

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

const selectedFile = useMemo(

() => files.find((file) => file.path === selectedPath) || files[0] || null,

[files, selectedPath]

);

function buildPromptWithGitHubTarget(rawPrompt: string) {

const repo = githubRepo.trim();

const branch = githubBranch.trim() || "main";

if (!repo) return rawPrompt;

return [

rawPrompt.trim(),

"",

`github repo: ${repo}`,

`github branch: ${branch}`,

].join("\n");

}

async function runAction(label: string, action: () => Promise<any>) {

setBusy(true);

setStatus(label);

try {

const value = await action();

setResult(value);

setStatus("Done.");

return value;

} catch (error: any) {

const message = error?.message || "Action failed.";

setStatus(message);

setResult({ ok: false, error: message });

return null;

} finally {

setBusy(false);

}

}

async function refreshJobs() {

const data = await listAutonomousJobs();

setJobs(data || []);

return data;

}

async function refreshJobFiles(jobId = activeJobId) {

if (!jobId) return null;

const data = await getAutonomousJobFiles(jobId);

const nextFiles = data.files || [];

setFiles(nextFiles);

setSelectedPath(nextFiles[0]?.path || "");

return data;

}

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

setResult({

ok: true,

snapshot,

});

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

setResult({

ok: true,

restored: snapshot,

});

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

await runAction("Starting real autonomous job...", async () => {

const finalPrompt = [

buildPromptWithGitHubTarget(prompt),

"",

"auto improve forever: true",

].join("\n");

const response = await startRealAutonomousJob({

prompt: finalPrompt,

});

if (!response.ok) {

throw new Error(response.error || "Autonomous job failed.");

}

setActiveJobId(response.jobId);

await refreshJobs();

return response;

});

}

async function handleStepJob() {

if (!activeJobId) {

setStatus("No active job selected.");

return;

}

await runAction("Running autonomous step...", async () => {

const job = await runAutonomousJobStep(activeJobId);

await refreshJobFiles(activeJobId);

await refreshJobs();

return job;

});

}

async function handleImproveJob(jobId = activeJobId) {

if (!jobId) {

setStatus("No job selected.");

return;

}

await runAction("Relaunching infinite improvement...", async () => {

const job = await improveAutonomousJob(jobId);

setActiveJobId(job.id);

await refreshJobs();

await refreshJobFiles(job.id);

return job;

});

}

async function handleResumeJob() {

if (!activeJobId) {

setStatus("No active job selected.");

return;

}

await runAction("Resuming job...", async () => {

const job = await resumeAutonomousJob(activeJobId);

await refreshJobs();

return job;

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

await runAction("Exporting current files to GitHub...", async () =>

exportToGitHub({

repo: githubRepo.trim(),

branch: githubBranch.trim() || "main",

commitMessage: "AutoApp manual export",

files,

})

);

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

await runAction("Writing real test file to GitHub...", async () =>

testGitHubExport({

repo: githubRepo.trim(),

branch: githubBranch.trim() || "main",

})

);

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

if (action === "Publish Report") {

return createPublishReport(files);

}

return null;

});

}

async function handleLoadTemplates() {

await runAction("Loading templates...", async () => listTemplates());

}

async function handleApplyTemplate(id: string) {

await runAction("Applying template...", async () => {

const template = await applyTemplate(id);

const templateFiles = template.files || [];

setFiles(templateFiles);

setSelectedPath(templateFiles[0]?.path || "");

return template;

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

{

path: normalized,

content: "",

},

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

file.path === selectedFile.path

? {

...file,

path: normalized,

}

: file

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

}, []);

useEffect(() => {

if (!autoRefreshJobs) return;

const timer = window.setInterval(() => {

refreshJobs().catch(() => undefined);

if (activeJobId) {

refreshJobFiles(activeJobId).catch(() => undefined);

}

}, 15_000);

return () => window.clearInterval(timer);

}, [autoRefreshJobs, activeJobId]);

return {

prompt,

setPrompt,

files,

setFiles,

selectedPath,

setSelectedPath,

selectedFile,

activeJobId,

setActiveJobId,

jobs,

refreshJobs,

refreshJobFiles,

githubRepo,

setGithubRepo,

githubBranch,

setGithubBranch,

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

handleGenerate,

handleStartAutonomous,

handleStepJob,

handleImproveJob,

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

export type AutoAppState = ReturnType<typeof useAutoApp>;
