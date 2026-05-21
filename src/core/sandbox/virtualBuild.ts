import type { VirtualFile } from "../engine/types";
import { parseBuildErrors, type BuildIssue } from "./errorParser";

export type VirtualBuildResult = {
  ok: boolean;
  issues: BuildIssue[];
  log: string;
};

export function virtualBuildCheck(files: VirtualFile[]): VirtualBuildResult {
  const log: string[] = [];
  const issues: BuildIssue[] = [];

  const paths = new Set(files.map((f) => normalize(f.path)));

  const packageFile = files.find((f) => normalize(f.path) === "/package.json");
  const srcEntry =
    has(paths, "/src/main.tsx") ||
    has(paths, "/src/main.jsx") ||
    has(paths, "/src/App.tsx") ||
    has(paths, "/src/App.jsx");

  if (!packageFile?.content) {
    log.push("Missing package.json");
  }

  if (!srcEntry) {
    log.push("Missing React entrypoint: /src/main.tsx or /src/App.tsx");
  }

  for (const file of files) {
    if (!file.content) continue;

    const content = file.content;

    if (file.path.endsWith(".tsx") || file.path.endsWith(".ts")) {
      if (content.includes("from '@/") && !hasAliasConfig(files)) {
        log.push(`${file.path}: uses @ alias but tsconfig/vite alias is missing`);
      }

      const imports = extractRelativeImports(content);

      for (const imported of imports) {
        const resolved = resolveImport(file.path, imported, paths);

        if (!resolved) {
          log.push(`${file.path}: Cannot find module '${imported}'`);
        }
      }
    }

    if (file.path.endsWith(".json")) {
      try {
        JSON.parse(content);
      } catch (error: any) {
        log.push(`${file.path}: JSON syntax error: ${error.message}`);
      }
    }

    if (content.includes("TODO_BROKEN") || content.includes("undefined undefined")) {
      log.push(`${file.path}: suspicious broken placeholder found`);
    }
  }

  const parsed = parseBuildErrors(log.join("\n"));
  issues.push(...parsed);

  return {
    ok: log.length === 0,
    issues,
    log: log.join("\n"),
  };
}

function normalize(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
}

function has(paths: Set<string>, path: string) {
  return paths.has(path);
}

function hasAliasConfig(files: VirtualFile[]) {
  return files.some((file) => {
    const path = normalize(file.path);
    const content = file.content || "";

    return (
      (path === "/vite.config.ts" || path === "/vite.config.js" || path === "/tsconfig.json") &&
      content.includes("@") &&
      content.includes("src")
    );
  });
}

function extractRelativeImports(content: string) {
  const imports = new Set<string>();
  const regex = /from\s+["'](\.{1,2}\/[^"']+)["']/g;

  let match: RegExpExecArray | null;

  while ((match = regex.exec(content))) {
    imports.add(match[1]);
  }

  return Array.from(imports);
}

function resolveImport(fromPath: string, imported: string, paths: Set<string>) {
  const baseParts = normalize(fromPath).split("/");
  baseParts.pop();

  for (const part of imported.split("/")) {
    if (part === ".") continue;
    if (part === "..") baseParts.pop();
    else baseParts.push(part);
  }

  const base = baseParts.join("/");

  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.jsx`,
    `${base}.json`,
    `${base}/index.ts`,
    `${base}/index.tsx`,
    `${base}/index.js`,
    `${base}/index.jsx`,
  ];

  return candidates.find((candidate) => paths.has(candidate));
                    }
