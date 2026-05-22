import { spawn, type ChildProcess } from "child_process";
import { mkdir, mkdtemp, rm, writeFile } from "fs/promises";
import net from "net";
import os from "os";
import path from "path";
import type { VirtualFile } from "../engine/types";

export type PreviewSession = {
  id: string;
  status: "starting" | "installing" | "running" | "error" | "stopped";
  port: number;
  url: string;
  tmpDir: string;
  logs: string[];
  createdAt: number;
  updatedAt: number;
  error?: string;
};

const sessions = new Map<string, PreviewSession>();
const processes = new Map<string, ChildProcess>();

const INSTALL_TIMEOUT_MS = 240_000;
const START_TIMEOUT_MS = 60_000;
const MAX_LOG_LINES = 120;

export async function startPreviewSession(files: VirtualFile[]) {
  const id = crypto.randomUUID();
  const port = await getFreePort();
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "forge-preview-"));
  const npmCacheDir = path.join(os.tmpdir(), "forge-npm-cache");

  const session: PreviewSession = {
    id,
    status: "starting",
    port,
    url: `http://localhost:${port}`,
    tmpDir,
    logs: ["Preview starting."],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  sessions.set(id, session);

  try {
    await mkdir(npmCacheDir, { recursive: true });
    await writeProjectFiles(tmpDir, files);

    updateSession(id, {
      status: "installing",
    });

    await runCommand({
      cwd: tmpDir,
      command: "npm",
      args: [
        "install",
        "--no-audit",
        "--no-fund",
        "--prefer-offline",
        "--cache",
        npmCacheDir,
      ],
      sessionId: id,
      timeoutMs: INSTALL_TIMEOUT_MS,
    });

    updateSession(id, {
      status: "starting",
    });

    const child = spawn(
      "npm",
      ["run", "dev", "--", "--host", "0.0.0.0", "--port", String(port)],
      {
        cwd: tmpDir,
        shell: process.platform === "win32",
        env: {
          ...process.env,
          NODE_ENV: "development",
          npm_config_loglevel: "error",
        },
      }
    );

    processes.set(id, child);

    child.stdout.on("data", (data) => pushLog(id, data.toString()));
    child.stderr.on("data", (data) => pushLog(id, data.toString()));

    child.on("close", () => {
      const current = sessions.get(id);
      if (!current || current.status === "stopped") return;
      updateSession(id, { status: "stopped" });
    });

    child.on("error", (error) => {
      updateSession(id, {
        status: "error",
        error: error.message,
      });
    });

    await waitForServer(port, START_TIMEOUT_MS);

    updateSession(id, {
      status: "running",
      url: `http://localhost:${port}`,
    });

    return sessions.get(id)!;
  } catch (error: any) {
    updateSession(id, {
      status: "error",
      error: error?.message || "Preview failed.",
    });

    return sessions.get(id)!;
  }
}

export function getPreviewSession(id: string) {
  return sessions.get(id);
}

export async function stopPreviewSession(id: string) {
  const child = processes.get(id);

  if (child) {
    child.kill("SIGTERM");
    processes.delete(id);
  }

  const session = sessions.get(id);

  if (session) {
    await rm(session.tmpDir, { recursive: true, force: true });

    updateSession(id, {
      status: "stopped",
    });
  }

  return sessions.get(id);
}

export async function cleanupPreviewSessions(maxAgeMs = 1000 * 60 * 60) {
  const now = Date.now();

  for (const [id, session] of sessions.entries()) {
    if (now - session.updatedAt > maxAgeMs) {
      await stopPreviewSession(id);
      sessions.delete(id);
    }
  }
}

function updateSession(id: string, patch: Partial<PreviewSession>) {
  const session = sessions.get(id);
  if (!session) return null;

  const next = {
    ...session,
    ...patch,
    updatedAt: Date.now(),
  };

  sessions.set(id, next);
  return next;
}

function pushLog(id: string, message: string) {
  const session = sessions.get(id);
  if (!session) return;

  const lines = message
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return;

  updateSession(id, {
    logs: [
      ...lines.map((line) => `${new Date().toLocaleTimeString()} · ${line}`),
      ...session.logs,
    ].slice(0, MAX_LOG_LINES),
  });
}

async function writeProjectFiles(root: string, files: VirtualFile[]) {
  for (const file of files) {
    if (!file.content) continue;

    const safePath = sanitizePath(file.path);
    if (!safePath) continue;

    const absolutePath = path.join(root, safePath);

    if (!absolutePath.startsWith(root)) continue;

    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, file.content, "utf8");
  }
}

function sanitizePath(filePath: string) {
  return filePath.replace(/^\/+/, "").replace(/\.\./g, "");
}

function runCommand(params: {
  cwd: string;
  command: string;
  args: string[];
  sessionId: string;
  timeoutMs: number;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(params.command, params.args, {
      cwd: params.cwd,
      shell: process.platform === "win32",
      env: {
        ...process.env,
        CI: "1",
        npm_config_loglevel: "error",
      },
    });

    let settled = false;

    const finish = (error?: Error) => {
      if (settled) return;

      settled = true;
      clearTimeout(timer);

      if (error) reject(error);
      else resolve();
    };

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish(new Error(`Command timed out after ${params.timeoutMs}ms`));
    }, params.timeoutMs);

    child.stdout.on("data", (data) => pushLog(params.sessionId, data.toString()));
    child.stderr.on("data", (data) => pushLog(params.sessionId, data.toString()));

    child.on("close", (code) => {
      if (code === 0) finish();
      else finish(new Error(`${params.command} failed with code ${code}`));
    });

    child.on("error", finish);
  });
}

function waitForServer(port: number, timeoutMs: number): Promise<void> {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const tryConnect = () => {
      const socket = net.createConnection({ port, host: "127.0.0.1" });

      socket.once("connect", () => {
        socket.destroy();
        resolve();
      });

      socket.once("error", () => {
        socket.destroy();

        if (Date.now() - startedAt > timeoutMs) {
          reject(new Error(`Preview server did not start after ${timeoutMs}ms`));
          return;
        }

        setTimeout(tryConnect, 500);
      });
    };

    tryConnect();
  });
}

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.listen(0, () => {
      const address = server.address();

      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Could not allocate preview port."));
        return;
      }

      const port = address.port;
      server.close(() => resolve(port));
    });

    server.on("error", reject);
  });
    }
