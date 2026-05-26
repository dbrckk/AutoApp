import { Hono } from "hono";

import type { Env, VirtualFile } from "../core/types";

import {
  cleanFiles,
  normalizePath,
} from "../core/files";

export const githubRoutes = new Hono<{
  Bindings: Env;
}>();

githubRoutes.post("/export", async (c) => {
  const body = await c.req
    .json()
    .catch(() => null);

  if (!body?.repo) {
    return c.json(
      {
        ok: false,
        error: "Missing repo",
      },
      400
    );
  }

  if (!body?.token) {
    return c.json(
      {
        ok: false,
        error: "Missing GitHub token",
      },
      400
    );
  }

  const ownerRepo = String(body.repo).trim();

  const branch =
    body.branch || "main";

  const commitMessage =
    body.commitMessage ||
    "AutoApp autonomous export";

  const files = cleanFiles(
    body.files || []
  );

  try {
    const latestCommit =
      await getLatestCommit({
        repo: ownerRepo,
        branch,
        token: body.token,
      });

    const baseTree =
      latestCommit.commit.tree.sha;

    const tree =
      await createGitTree({
        repo: ownerRepo,
        token: body.token,
        baseTree,
        files,
      });

    const commit =
      await createCommit({
        repo: ownerRepo,
        token: body.token,
        message: commitMessage,
        treeSha: tree.sha,
        parentSha:
          latestCommit.sha,
      });

    await updateBranchRef({
      repo: ownerRepo,
      token: body.token,
      branch,
      commitSha: commit.sha,
    });

    return c.json({
      ok: true,
      repo: ownerRepo,
      branch,
      commitSha: commit.sha,
      commitUrl: `https://github.com/${ownerRepo}/commit/${commit.sha}`,
    });
  } catch (error: any) {
    return c.json(
      {
        ok: false,
        error:
          error?.message ||
          "GitHub export failed",
      },
      500
    );
  }
});

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
  const response = await fetch(
    `https://api.github.com/repos/${repo}${path}`,
    {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept:
          "application/vnd.github+json",
        "Content-Type":
          "application/json",
      },
      body: body
        ? JSON.stringify(body)
        : undefined,
    }
  );

  const data: any =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data?.message ||
        "GitHub API request failed"
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
        path: normalizePath(
          file.path
        ).replace(/^\//, ""),
        mode: "100644",
        type: "blob",
        content:
          file.content || "",
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
      force: true,
    },
  });
        }
