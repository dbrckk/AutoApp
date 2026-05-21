import { spawn, type ChildProcess } from "child_process";
import { mkdtemp, mkdir, rm, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import type { VirtualFile } from "../engine/types";

export type PreviewSession = {
  id: string;
  status: "starting" | "running" | "error" | "stopped";
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

export async function startPreviewSession(files: VirtualFile[]) {
  const id = crypto.randomUUID();
  const port = await getFreePort();
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "forge-preview-"));

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
    await writeProjectFiles(tmpDir, files);

    await runCommand(tmpDir, "npm", ["install", "--no-audit", "--no-fund"], id);

    const child = spawn("npm", ["run", "dev", "--", "--host", "0.0.0.0", "--port", String(port)], {
      cwd: tmpDir,
      shell: process.platform === "win32",
      env: {
        ...process.env,
        NODE_ENV: "development",
      },
    });

    processes.set(id, child);

    child.stdout.on("data", (data) => pushLog(id, data.toString()));
    child.stderr.on("data", (data) => pushLog(id, data.toString()));

    child.on("close", () => {
      const current = sessions.get(id);
      if (!current) return;
      updateSession(id, { status: "stopped" });
    });

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

  updateSession(id, {
    logs: [
      `${new Date().toLocaleTimeString()} · ${message.trim()}`,
      ...session.logs,
    ].slice(0, 100),
  });
}

async function writeProjectFiles(root: string, files: VirtualFile[]) {
  for (const file of files) {
    if (!file.content) continue;

    const safePath = file.path.replace(/^\/+/, "").replace(/\.\./g, "");
    const absolutePath = path.join(root, safePath);

    if (!absolutePath.startsWith(root)) continue;

    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, file.content, "utf8");
  }
}

function runCommand(
  cwd: string,
  command: string,
  args: string[],
  sessionId: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      shell: process.platform === "win32",
      env: {
        ...process.env,
        CI: "1",
      },
    });

    let log = "";

    child.stdout.on("data", (data) => {
      const text = data.toString();
      log += text;
      pushLog(sessionId, text);
    });

    child.stderr.on("data", (data) => {
      const text = data.toString();
      log += text;
      pushLog(sessionId, text);
    });

    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(log || `${command} failed with code ${code}`));
    });

    child.on("error", reject);
  });
}

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    import("net").then((net) => {
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
  });
        }
