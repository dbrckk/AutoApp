import { Hono } from "hono";

import type { Env, VirtualFile } from "../core/types";

import { cleanFiles, normalizePath } from "../core/files";

export const githubRoutes = new Hono<{ Bindings: Env }>();

export async function exportFilesToGitHub({

token,

repo,

branch = "main",

commitMessage = "AutoApp autonomous export",

files,

}: {

token: string;

repo: string;

branch?: string;

commitMessage?: string;

files: VirtualFile[];

}) {

if (!token) throw new Error("Missing GitHub token.");

if (!repo) throw new Error("Missing GitHub repo.");

if (!files.length) throw new Error("No files to export.");

const latestCommit = await getLatestCommit({ repo, branch, token });

const baseCommitSha = latestCommit.object?.sha || latestCommit.sha;

const commitData = await getCommit({

repo,

token,

sha: baseCommitSha,

});

const tree = await createGitTree({

repo,

token,

baseTree: commitData.commit.tree.sha,

files,

});

const commit = await createCommit({

repo,

token,

message: commitMessage,

treeSha: tree.sha,

parentSha: baseCommitSha,

});

await updateBranchRef({

repo,

token,

branch,

commitSha: commit.sha,

});

return {

ok: true,

repo,

branch,

commitSha: commit.sha,

commitUrl: `https://github.com/${repo}/commit/${commit.sha}`,

};

}

githubRoutes.post("/export", async (c) => {

const body = await c.req.json().catch(() => null);

const token = c.env.GITHUB_TOKEN || body?.token;

if (!body?.repo) {

return c.json({ ok: false, error: "Missing repo" }, 400);

}

if (!token) {

return c.json(

{

ok: false,

error: "Missing GITHUB_TOKEN secret in Cloudflare Worker.",

},

400

);

}

const repo = String(body.repo).trim();

const branch = body.branch || "main";

const commitMessage = body.commitMessage || "AutoApp autonomous export";

const files = cleanFiles(body.files || []);

try {

const result = await exportFilesToGitHub({

token,

repo,

branch,

commitMessage,

files,

});

return c.json(result);

} catch (error: any) {

return c.json(

{

ok: false,

error: error?.message || "GitHub export failed",

},

500

);

}

});

githubRoutes.post("/test-export", async (c) => {

const body = await c.req.json().catch(() => null);

const token = c.env.GITHUB_TOKEN || body?.token;

if (!body?.repo) {

return c.json({ ok: false, error: "Missing repo" }, 400);

}

if (!token) {

return c.json(

{

ok: false,

error: "Missing GITHUB_TOKEN secret in Cloudflare Worker.",

},

400

);

}

const repo = String(body.repo).trim();

const branch = body.branch || "main";

const files: VirtualFile[] = [

{

path: "/.autoapp-test.json",

content: JSON.stringify(

{

ok: true,

source: "AutoApp GitHub test export",

timestamp: new Date().toISOString(),

},

null,

2

),

},

];

try {

const result = await exportFilesToGitHub({

token,

repo,

branch,

commitMessage: "AutoApp GitHub write test",

files,

});

return c.json({

ok: true,

test: "real_github_write",

result,

});

} catch (error: any) {

return c.json(

{

ok: false,

error: error?.message || "GitHub test export failed",

},

500

);

}

});

githubRoutes.get("/latest", async (c) => {

const repo = c.req.query("repo");

const branch = c.req.query("branch") || "main";

const token = c.env.GITHUB_TOKEN;

if (!repo) {

return c.json({ ok: false, error: "Missing repo" }, 400);

}

if (!token) {

return c.json({ ok: false, error: "Missing GITHUB_TOKEN" }, 400);

}

try {

const ref = await getLatestCommit({

repo,

branch,

token,

});

const sha = ref.object?.sha || ref.sha;

return c.json({

ok: true,

repo,

branch,

sha,

commitUrl: `https://github.com/${repo}/commit/${sha}`,

});

} catch (error: any) {

return c.json(

{

ok: false,

error: error?.message || "GitHub latest commit check failed",

},

500

);

}

});

githubRoutes.get("/history", async (c) => {

const repo = c.req.query("repo");

const branch = c.req.query("branch") || "main";

const token = c.env.GITHUB_TOKEN;

if (!repo) {

return c.json({ ok: false, error: "Missing repo" }, 400);

}

if (!token) {

return c.json({ ok: false, error: "Missing GITHUB_TOKEN" }, 400);

}

try {

const commits = await githubRequest({

repo,

token,

path: `/commits?sha=${encodeURIComponent(branch)}&per_page=20`,

});

return c.json({

ok: true,

repo,

branch,

commits: Array.isArray(commits)

? commits.map((commit: any) => ({

sha: commit.sha,

message: commit.commit?.message || "",

author: commit.commit?.author?.name || "unknown",

date: commit.commit?.author?.date || "",

url: commit.html_url,

}))

: [],

});

} catch (error: any) {

return c.json(

{

ok: false,

error: error?.message || "GitHub history check failed",

},

500

);

}

});

githubRoutes.get("/file", async (c) => {

const repo = c.req.query("repo");

const branch = c.req.query("branch") || "main";

const filePath = c.req.query("path");

const token = c.env.GITHUB_TOKEN;

if (!repo) {

return c.json({ ok: false, error: "Missing repo" }, 400);

}

if (!filePath) {

return c.json({ ok: false, error: "Missing path" }, 400);

}

if (!token) {

return c.json({ ok: false, error: "Missing GITHUB_TOKEN" }, 400);

}

try {

const data = await githubRequest({

repo,

token,

path: `/contents/${encodePathForGitHubContents(

filePath

)}?ref=${encodeURIComponent(branch)}`,

});

return c.json({

ok: true,

repo,

branch,

path: filePath,

sha: data.sha,

size: data.size,

htmlUrl: data.html_url,

downloadUrl: data.download_url,

type: data.type,

});

} catch (error: any) {

return c.json(

{

ok: false,

error: error?.message || "GitHub file check failed",

},

500

);

}

});

export async function testGitHubAccess({

token,

repo,

branch = "main",

}: {

token: string;

repo: string;

branch?: string;

}) {

if (!token) throw new Error("Missing GitHub token.");

if (!repo) throw new Error("Missing GitHub repo.");

const repository = await githubRequest({

repo,

token,

path: "",

});

const ref = await getLatestCommit({

repo,

branch,

token,

});

return {

ok: true,

repo,

branch,

private: Boolean(repository.private),

defaultBranch: repository.default_branch,

permissions: repository.permissions || null,

latestCommitSha: ref.object?.sha || ref.sha,

};

}

async function githubRequest({

repo,

token,

path,

method = "GET",

body,

}: {

repo: string;

token: string;

path: string;

method?: string;

body?: unknown;

}) {

const response = await fetch(`https://api.github.com/repos/${repo}${path}`, {

method,

headers: {

Authorization: `Bearer ${token}`,

Accept: "application/vnd.github+json",

"Content-Type": "application/json",

"User-Agent": "AutoApp-Cloudflare-Worker",

"X-GitHub-Api-Version": "2022-11-28",

},

body: body ? JSON.stringify(body) : undefined,

});

const data: any = await response.json();

if (!response.ok) {

throw new Error(

data?.message || `GitHub API request failed: ${response.status}`

);

}

return data;

}

async function getLatestCommit({

repo,

branch,

token,

}: {

repo: string;

branch: string;

token: string;

}) {

return githubRequest({

repo,

token,

path: `/git/ref/heads/${branch}`,

});

}

async function getCommit({

repo,

token,

sha,

}: {

repo: string;

token: string;

sha: string;

}) {

return githubRequest({

repo,

token,

path: `/git/commits/${sha}`,

});

}

async function createGitTree({

repo,

token,

baseTree,

files,

}: {

repo: string;

token: string;

baseTree: string;

files: VirtualFile[];

}) {

return githubRequest({

repo,

token,

path: "/git/trees",

method: "POST",

body: {

base_tree: baseTree,

tree: files.map((file) => ({

path: normalizePath(file.path).replace(/^\//, ""),

mode: "100644",

type: "blob",

content: file.content || "",

})),

},

});

}

async function createCommit({

repo,

token,

message,

treeSha,

parentSha,

}: {

repo: string;

token: string;

message: string;

treeSha: string;

parentSha: string;

}) {

return githubRequest({

repo,

token,

path: "/git/commits",

method: "POST",

body: {

message,

tree: treeSha,

parents: [parentSha],

},

});

}

async function updateBranchRef({

repo,

token,

branch,

commitSha,

}: {

repo: string;

token: string;

branch: string;

commitSha: string;

}) {

return githubRequest({

repo,

token,

path: `/git/refs/heads/${branch}`,

method: "PATCH",

body: {

sha: commitSha,

force: false,

},

});

}

function encodePathForGitHubContents(path: string) {

return normalizePath(path)

.replace(/^\//, "")

.split("/")

.map(encodeURIComponent)

.join("/");

              }
