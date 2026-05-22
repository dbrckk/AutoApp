import type { VirtualFile } from "../engine/types";
import { parseBuildErrors, type BuildIssue } from "./errorParser";

export type VirtualBuildResult = {
  ok: boolean;
  issues: BuildIssue[];
  log: string;
};

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"];

export function virtualBuildCheck(files: VirtualFile[]): VirtualBuildResult {
  const logs: string[] = [];
  const paths = new Set(files.map((file) => normalizePath(file.path)));

  validatePackageJson(files, logs);
  validateEntrypoints(paths, logs);
  validateViteAlias(files, logs);
  validateRelativeImports(files, paths, logs);
  validatePackageImports(files, logs);
  validateJsonFiles(files, logs);
  validateCommonSyntax(files, logs);

  const log = logs.join("\n");
  const issues = parseBuildErrors(log);

  return {
    ok: issues.length === 0,
    issues,
    log,
  };
}

function validatePackageJson(files: VirtualFile[], logs: string[]) {
  const packageFile = getFile(files, "/package.json");

  if (!packageFile?.content) {
    logs.push("Missing /package.json");
    return;
  }

  try {
    const json = JSON.parse(packageFile.content);

    if (!json.scripts?.build) {
      logs.push("/package.json: missing scripts.build");
    }

    if (!json.scripts?.dev) {
      logs.push("/package.json: missing scripts.dev");
    }

    if (!json.dependencies?.react && !json.devDependencies?.react) {
      logs.push("/package.json: Cannot find module 'react'");
    }

    if (!json.dependencies?.["react-dom"] && !json.devDependencies?.["react-dom"]) {
      logs.push("/package.json: Cannot find module 'react-dom'");
    }
  } catch (error: any) {
    logs.push(`/package.json: JSON syntax error: ${error.message}`);
  }
}

function validateEntrypoints(paths: Set<string>, logs: string[]) {
  const hasViteEntry =
    paths.has("/index.html") &&
    (paths.has("/src/main.tsx") || paths.has("/src/main.jsx"));

  const hasNextEntry = paths.has("/app/page.tsx") || paths.has("/pages/index.tsx");

  if (!hasViteEntry && !hasNextEntry) {
    logs.push("Missing React/Vite entrypoint: /index.html + /src/main.tsx");
  }

  if (paths.has("/index.html") && !paths.has("/src/main.tsx") && !paths.has("/src/main.jsx")) {
    logs.push("/index.html: Cannot find module '/src/main.tsx'");
  }
}

function validateViteAlias(files: VirtualFile[], logs: string[]) {
  const usesAlias = files.some((file) => file.content?.includes("from \"@/") || file.content?.includes("from '@/"));

  if (!usesAlias) return;

  const viteConfig =
    getFile(files, "/vite.config.ts")?.content ||
    getFile(files, "/vite.config.js")?.content ||
    "";

  const tsConfig = getFile(files, "/tsconfig.json")?.content || "";

  if (!viteConfig.includes("alias") || !viteConfig.includes("@")) {
    logs.push("/vite.config.ts: uses @ alias but Vite alias is missing");
  }

  if (!tsConfig.includes("paths") || !tsConfig.includes("@/*")) {
    logs.push("/tsconfig.json: uses @ alias but TypeScript paths are missing");
  }
}

function validateRelativeImports(files: VirtualFile[], paths: Set<string>, logs: string[]) {
  for (const file of files) {
    if (!file.content) continue;
    if (!isSourceFile(file.path)) continue;

    const imports = extractImports(file.content).filter(
      (importPath) => importPath.startsWith(".") || importPath.startsWith("/")
    );

    for (const importPath of imports) {
      const resolved = resolveImport(file.path, importPath, paths);

      if (!resolved) {
        logs.push(`${file.path}: Cannot find module '${importPath}'`);
      }
    }
  }
}

function validatePackageImports(files: VirtualFile[], logs: string[]) {
  const packageJson = readPackageJson(files);
  if (!packageJson) return;

  const declared = new Set([
    ...Object.keys(packageJson.dependencies || {}),
    ...Object.keys(packageJson.devDependencies || {}),
    ...Object.keys(packageJson.peerDependencies || {}),
  ]);

  for (const file of files) {
    if (!file.content) continue;
    if (!isSourceFile(file.path)) continue;

    const imports = extractImports(file.content).filter(
      (importPath) =>
        !importPath.startsWith(".") &&
        !importPath.startsWith("/") &&
        !importPath.startsWith("@/")
    );

    for (const importPath of imports) {
      const pkg = normalizePackageName(importPath);

      if (!pkg) continue;
      if (isBuiltin(pkg)) continue;

      if (!declared.has(pkg)) {
        logs.push(`${file.path}: Cannot find module '${pkg}'`);
      }
    }
  }
}

function validateJsonFiles(files: VirtualFile[], logs: string[]) {
  for (const file of files) {
    if (!file.path.endsWith(".json")) continue;
    if (!file.content) continue;

    try {
      JSON.parse(file.content);
    } catch (error: any) {
      logs.push(`${file.path}: JSON syntax error: ${error.message}`);
    }
  }
}

function validateCommonSyntax(files: VirtualFile[], logs: string[]) {
  for (const file of files) {
    if (!file.content) continue;
    if (!isSourceFile(file.path)) continue;

    const content = file.content;

    if (content.includes("TODO_BROKEN")) {
      logs.push(`${file.path}: suspicious broken placeholder found`);
    }

    if (hasUnbalanced(content, "{", "}")) {
      logs.push(`${file.path}: SyntaxError: unbalanced curly braces`);
    }

    if (hasUnbalanced(content, "(", ")")) {
      logs.push(`${file.path}: SyntaxError: unbalanced parentheses`);
    }

    if (file.path.endsWith(".tsx") || file.path.endsWith(".jsx")) {
      if (hasLikelyBrokenJsx(content)) {
        logs.push(`${file.path}: SyntaxError: likely broken JSX tag structure`);
      }
    }
  }
}

function getFile(files: VirtualFile[], path: string) {
  return files.find((file) => normalizePath(file.path) === path);
}

function readPackageJson(files: VirtualFile[]) {
  const packageFile = getFile(files, "/package.json");
  if (!packageFile?.content) return null;

  try {
    return JSON.parse(packageFile.content);
  } catch {
    return null;
  }
}

function normalizePath(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
}

function isSourceFile(path: string) {
  return SOURCE_EXTENSIONS.some((ext) => path.endsWith(ext));
}

function extractImports(content: string) {
  const imports = new Set<string>();

  const patterns = [
    /import\s+[^'"]*from\s+["']([^"']+)["']/g,
    /import\s+["']([^"']+)["']/g,
    /import\s*\(\s*["']([^"']+)["']\s*\)/g,
    /require\s*\(\s*["']([^"']+)["']\s*\)/g,
    /export\s+[^'"]*from\s+["']([^"']+)["']/g,
  ];

  for (const regex of patterns) {
    let match: RegExpExecArray | null;

    while ((match = regex.exec(content))) {
      imports.add(match[1]);
    }
  }

  return Array.from(imports);
}

function resolveImport(fromPath: string, imported: string, paths: Set<string>) {
  if (imported.startsWith("/")) {
    return resolveCandidates(imported, paths);
  }

  const baseParts = normalizePath(fromPath).split("/");
  baseParts.pop();

  for (const part of imported.split("/")) {
    if (part === ".") continue;
    if (part === "..") baseParts.pop();
    else baseParts.push(part);
  }

  return resolveCandidates(baseParts.join("/"), paths);
}

function resolveCandidates(base: string, paths: Set<string>) {
  const normalized = normalizePath(base);

  const candidates = [
    normalized,
    `${normalized}.ts`,
    `${normalized}.tsx`,
    `${normalized}.js`,
    `${normalized}.jsx`,
    `${normalized}.json`,
    `${normalized}.css`,
    `${normalized}/index.ts`,
    `${normalized}/index.tsx`,
    `${normalized}/index.js`,
    `${normalized}/index.jsx`,
  ];

  return candidates.find((candidate) => paths.has(candidate));
}

function normalizePackageName(value: string) {
  if (!value || value.startsWith(".") || value.startsWith("/")) return null;

  if (value.startsWith("@")) {
    const parts = value.split("/");
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : value;
  }

  return value.split("/")[0];
}

function isBuiltin(pkg: string) {
  return [
    "fs",
    "path",
    "os",
    "url",
    "crypto",
    "http",
    "https",
    "stream",
    "buffer",
    "child_process",
    "events",
    "util",
    "zlib",
    "net",
  ].includes(pkg);
}

function hasUnbalanced(content: string, open: string, close: string) {
  let count = 0;
  let inString: string | null = null;
  let escaped = false;

  for (const char of content) {
    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (inString) {
      if (char === inString) inString = null;
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      inString = char;
      continue;
    }

    if (char === open) count++;
    if (char === close) count--;
    if (count < 0) return true;
  }

  return count !== 0;
}

function hasLikelyBrokenJsx(content: string) {
  const openTags = (content.match(/<([A-Z][A-Za-z0-9]*)\b[^>/]*>/g) || []).length;
  const closeTags = (content.match(/<\/([A-Z][A-Za-z0-9]*)>/g) || []).length;

  return closeTags > openTags;
    }
