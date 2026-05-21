import { mkdtemp, rm, writeFile, mkdir } from "fs/promises";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import type { VirtualFile } from "../engine/types";
import { parseBuildErrors, type BuildIssue } from "./errorParser";

export type RealBuildResult = {
  ok: boolean;
  issues: BuildIssue[];
  log: string;
  tmpDir?: string;
};

export async function runRealBuild(files: VirtualFile[]): Promise<RealBuildResult> {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "forge-build-"));

  try {
    await writeProjectFiles(tmpDir, files);

    const install = await runCommand(tmpDir, "npm", ["install", "--no-audit", "--no-fund"], 180_000);

    if (!install.ok) {
      return {
        ok: false,
        issues: parseBuildErrors(install.log),
        log: install.log,
        tmpDir,
      };
    }

    const build = await runCommand(tmpDir, "npm", ["run", "build"], 180_000);

    return {
      ok: build.ok,
      issues: parseBuildErrors(build.log),
      log: build.log,
      tmpDir,
    };
  } finally {
    if (process.env.FORGE_KEEP_TMP !== "1") {
      await rm(tmpDir, { recursive: true, force: true });
    }
  }
}

async function writeProjectFiles(root: string, files: VirtualFile[]) {
  for (const file of files) {
    if (!file.content) continue;

    const safePath = sanitizePath(file.path);
    const absolutePath = path.join(root, safePath);

    if (!absolutePath.startsWith(root)) {
      continue;
    }

    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, file.content, "utf8");
  }
}

function sanitizePath(filePath: string) {
  return filePath.replace(/^\/+/, "").replace(/\.\./g, "");
}

function runCommand(
  cwd: string,
  command: string,
  args: string[],
  timeoutMs: number
): Promise<{ ok: boolean; log: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      shell: process.platform === "win32",
      env: {
        ...process.env,
        CI: "1",
        NODE_ENV: "production",
      },
    });

    let log = "";

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolve({
        ok: false,
        log: log + `\nCommand timed out after ${timeoutMs}ms`,
      });
    }, timeoutMs);

    child.stdout.on("data", (data) => {
      log += data.toString();
    });

    child.stderr.on("data", (data) => {
      log += data.toString();
    });

    child.on("close", (code) => {
      clearTimeout(timer);

      resolve({
        ok: code === 0,
        log,
      });
    });

    child.on("error", (error) => {
      clearTimeout(timer);

      resolve({
        ok: false,
        log: log + `\n${error.message}`,
      });
    });
  });
  }
