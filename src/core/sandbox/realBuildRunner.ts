import { spawn } from "child_process";
import { access, mkdir, mkdtemp, rm, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import type { VirtualFile } from "../engine/types";
import { parseBuildErrors, type BuildIssue } from "./errorParser";

export type RealBuildResult = {
  ok: boolean;
  issues: BuildIssue[];
  log: string;
  tmpDir?: string;
};

const INSTALL_TIMEOUT_MS = 240_000;
const BUILD_TIMEOUT_MS = 240_000;
const MAX_LOG_CHARS = 80_000;

export async function runRealBuild(files: VirtualFile[]): Promise<RealBuildResult> {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "forge-build-"));
  const npmCacheDir = path.join(os.tmpdir(), "forge-npm-cache");

  try {
    await mkdir(npmCacheDir, { recursive: true });
    await writeProjectFiles(tmpDir, files);

    const preflight = await preflightProject(tmpDir);

    if (!preflight.ok) {
      return {
        ok: false,
        issues: parseBuildErrors(preflight.log),
        log: preflight.log,
        tmpDir,
      };
    }

    const install = await runCommand({
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
      timeoutMs: INSTALL_TIMEOUT_MS,
    });

    if (!install.ok) {
      return {
        ok: false,
        issues: parseBuildErrors(install.log),
        log: install.log,
        tmpDir,
      };
    }

    const build = await runCommand({
      cwd: tmpDir,
      command: "npm",
      args: ["run", "build"],
      timeoutMs: BUILD_TIMEOUT_MS,
    });

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

async function preflightProject(root: string) {
  const required = ["package.json"];

  for (const file of required) {
    const exists = await existsFile(path.join(root, file));

    if (!exists) {
      return {
        ok: false,
        log: `Missing ${file}`,
      };
    }
  }

  return {
    ok: true,
    log: "Preflight passed.",
  };
}

async function existsFile(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
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
  timeoutMs: number;
}): Promise<{ ok: boolean; log: string }> {
  return new Promise((resolve) => {
    const child = spawn(params.command, params.args, {
      cwd: params.cwd,
      shell: process.platform === "win32",
      env: {
        ...process.env,
        CI: "1",
        NODE_ENV: "production",
        npm_config_loglevel: "error",
      },
    });

    let log = "";
    let settled = false;

    const append = (data: unknown) => {
      log += String(data);

      if (log.length > MAX_LOG_CHARS) {
        log = log.slice(-MAX_LOG_CHARS);
      }
    };

    const finish = (ok: boolean, extra = "") => {
      if (settled) return;

      settled = true;
      clearTimeout(timer);

      if (extra) append(extra);

      resolve({
        ok,
        log: log.trim(),
      });
    };

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish(false, `\nCommand timed out after ${params.timeoutMs}ms`);
    }, params.timeoutMs);

    child.stdout.on("data", append);
    child.stderr.on("data", append);

    child.on("close", (code) => {
      finish(code === 0);
    });

    child.on("error", (error) => {
      finish(false, `\n${error.message}`);
    });
  });
        }
