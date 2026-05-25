import type { VirtualFile } from "./types";
import {
  normalizePackageName,
  normalizePath,
  readPackageJson,
  sortObject,
} from "./files";

export function virtualBuildCheck(files: VirtualFile[]) {
  const logs: string[] = [];
  const paths = new Set(files.map((file) => normalizePath(file.path)));
  const packageFile = files.find(
    (file) => normalizePath(file.path) === "/package.json"
  );

  validatePackageJson(packageFile, logs);
  validateEntrypoints(paths, logs);
  validateRelativeImports(files, paths, logs);
  validatePackageImports(files, packageFile, logs);
  validateJsonFiles(files, logs);

  return {
    ok: logs.length === 0,
    issues: logs.map((message) => ({
      type: detectIssueType(message),
      message,
      raw: message,
    })),
    log: logs.join("\n"),
  };
}

function validatePackageJson(
  packageFile: VirtualFile | undefined,
  logs: string[]
) {
  if (!packageFile?.content) {
    logs.push("Missing /package.json");
    return;
  }

  try {
    const pkg = JSON.parse(packageFile.content);

    if (!pkg.scripts?.build) logs.push("/package.json: missing scripts.build");
    if (!pkg.scripts?.dev) logs.push("/package.json: missing scripts.dev");

    if (!pkg.dependencies?.react && !pkg.devDependencies?.react) {
      logs.push("/package.json: Cannot find module 'react'");
    }

    if (!pkg.dependencies?.["react-dom"] && !pkg.devDependencies?.["react-dom"]) {
      logs.push("/package.json: Cannot find module 'react-dom'");
    }
  } catch {
    logs.push("/package.json: invalid JSON");
  }
}

function validateEntrypoints(paths: Set<string>, logs: string[]) {
  if (!paths.has("/index.html")) {
    logs.push("Missing /index.html");
  }

  if (!paths.has("/src/main.tsx") && !paths.has("/src/main.jsx")) {
    logs.push("Missing /src/main.tsx");
  }

  if (!paths.has("/src/App.tsx") && !paths.has("/src/App.jsx")) {
    logs.push("Missing /src/App.tsx");
  }
}

function validateRelativeImports(
  files: VirtualFile[],
  paths: Set<string>,
  logs: string[]
) {
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

function validatePackageImports(
  files: VirtualFile[],
  packageFile: VirtualFile | undefined,
  logs: string[]
) {
  if (!packageFile?.content) return;

  let pkg: any = null;

  try {
    pkg = JSON.parse(packageFile.content);
  } catch {
    return;
  }

  const declared = new Set([
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
    ...Object.keys(pkg.peerDependencies || {}),
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
      const packageName = normalizePackageName(importPath);

      if (!packageName) continue;
      if (isBuiltinPackage(packageName)) continue;

      if (!declared.has(packageName)) {
        logs.push(`${file.path}: Cannot find module '${packageName}'`);
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
    } catch {
      logs.push(`${file.path}: invalid JSON`);
    }
  }
}

export function resolveDependencies(files: VirtualFile[]) {
  const used = new Set<string>();

  for (const file of files) {
    if (!file.content) continue;
    if (!isSourceFile(file.path)) continue;

    const imports = extractImports(file.content);

    for (const importPath of imports) {
      const packageName = normalizePackageName(importPath);

      if (!packageName) continue;
      if (packageName.startsWith(".")) continue;
      if (packageName.startsWith("/")) continue;
      if (packageName.startsWith("@/")) continue;
      if (isBuiltinPackage(packageName)) continue;

      used.add(packageName);
    }
  }

  const packageJson = readPackageJson(files) || createDefaultPackageJson();

  packageJson.name ||= "generated-app";
  packageJson.private = true;
  packageJson.version ||= "1.0.0";
  packageJson.type ||= "module";

  packageJson.scripts = {
    dev: "vite",
    build: "vite build",
    preview: "vite preview",
    ...(packageJson.scripts || {}),
  };

  packageJson.dependencies ||= {};
  packageJson.devDependencies ||= {};

  ensureBaseDependencies(packageJson);

  const target = detectTargetFromFiles(files);

  if (target.includes("android")) {
    ensureAndroidDependencies(packageJson);
  }

  const declared = new Set([
    ...Object.keys(packageJson.dependencies || {}),
    ...Object.keys(packageJson.devDependencies || {}),
    ...Object.keys(packageJson.peerDependencies || {}),
  ]);

  const missing = Array.from(used).filter((pkg) => !declared.has(pkg));

  for (const pkg of missing) {
    if (isDevDependency(pkg)) {
      packageJson.devDependencies[pkg] = defaultVersion(pkg);
    } else {
      packageJson.dependencies[pkg] = defaultVersion(pkg);
    }
  }

  cleanupDependencyPlacement(packageJson);

  return {
    ok: missing.length === 0,
    packageJsonFound: true,
    usedPackages: Array.from(used).sort(),
    declaredDependencies: Array.from(
      new Set([
        ...Object.keys(packageJson.dependencies || {}),
        ...Object.keys(packageJson.devDependencies || {}),
      ])
    ).sort(),
    missingDependencies: missing.sort(),
    packageJson: JSON.stringify(packageJson, null, 2),
    warnings: [],
  };
}

export function applyDependencyResolution(
  files: VirtualFile[],
  packageJson?: string
): VirtualFile[] {
  return [
    ...files.filter((file) => normalizePath(file.path) !== "/package.json"),
    {
      path: "/package.json",
      content: packageJson || resolveDependencies(files).packageJson || "",
    },
  ].sort((a, b) => a.path.localeCompare(b.path));
}

export function extractImports(content: string): string[] {
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

function resolveImport(
  fromPath: string,
  imported: string,
  paths: Set<string>
): string | undefined {
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

function resolveCandidates(base: string, paths: Set<string>): string | undefined {
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

function createDefaultPackageJson() {
  return {
    name: "generated-app",
    private: true,
    version: "1.0.0",
    type: "module",
    scripts: {
      dev: "vite",
      build: "vite build",
      preview: "vite preview",
    },
    dependencies: {},
    devDependencies: {},
  };
}

function ensureBaseDependencies(packageJson: any) {
  packageJson.dependencies.react ||= "latest";
  packageJson.dependencies["react-dom"] ||= "latest";
  packageJson.dependencies["@tailwindcss/vite"] ||= "latest";

  packageJson.devDependencies.vite ||= "latest";
  packageJson.devDependencies.typescript ||= "latest";
  packageJson.devDependencies["@vitejs/plugin-react"] ||= "latest";
}

function ensureAndroidDependencies(packageJson: any) {
  packageJson.dependencies["@capacitor/core"] ||= "latest";
  packageJson.devDependencies["@capacitor/cli"] ||= "latest";
  packageJson.devDependencies["@capacitor/android"] ||= "latest";
}

function cleanupDependencyPlacement(packageJson: any) {
  for (const dep of Object.keys(packageJson.dependencies || {})) {
    if (isDevDependency(dep)) {
      packageJson.devDependencies[dep] =
        packageJson.devDependencies[dep] || packageJson.dependencies[dep];

      delete packageJson.dependencies[dep];
    }
  }

  packageJson.dependencies = sortObject(packageJson.dependencies || {});
  packageJson.devDependencies = sortObject(packageJson.devDependencies || {});
  packageJson.scripts = sortObject(packageJson.scripts || {});
}

function defaultVersion(pkg: string) {
  const versions: Record<string, string> = {
    react: "latest",
    "react-dom": "latest",
    vite: "latest",
    typescript: "latest",
    "@vitejs/plugin-react": "latest",
    "@tailwindcss/vite": "latest",
    tailwindcss: "latest",
    "lucide-react": "latest",
    "framer-motion": "latest",
    recharts: "latest",
    clsx: "latest",
    "tailwind-merge": "latest",
    "@capacitor/core": "latest",
    "@capacitor/cli": "latest",
    "@capacitor/android": "latest",
  };

  return versions[pkg] || "latest";
}

function isDevDependency(pkg: string) {
  return [
    "vite",
    "typescript",
    "@vitejs/plugin-react",
    "tailwindcss",
    "eslint",
    "prettier",
    "vitest",
    "@types/react",
    "@types/react-dom",
    "@types/node",
    "@capacitor/cli",
    "@capacitor/android",
  ].includes(pkg);
}

function isSourceFile(path: string) {
  return [".ts", ".tsx", ".js", ".jsx"].some((ext) => path.endsWith(ext));
}

function isBuiltinPackage(packageName: string) {
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
    "events",
    "util",
  ].includes(packageName);
}

function detectIssueType(message: string) {
  const lower = message.toLowerCase();

  if (lower.includes("cannot find module")) return "missing_dependency";
  if (lower.includes("invalid json")) return "json";
  if (lower.includes("missing")) return "missing_file";

  return "unknown";
}

function detectTargetFromFiles(files: VirtualFile[]) {
  const text = files
    .map((file) => `${file.path}\n${file.content || ""}`)
    .join("\n")
    .toLowerCase();

  if (text.includes("capacitor") || text.includes("android")) return "android";
  return "web";
}
