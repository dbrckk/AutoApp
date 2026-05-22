import type { VirtualFile } from "../engine/types";

export type DependencyResolution = {
  ok: boolean;
  packageJsonFound: boolean;
  usedPackages: string[];
  declaredDependencies: string[];
  missingDependencies: string[];
  packageJson?: string;
  warnings: string[];
};

const BUILTIN_MODULES = new Set([
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
  "tls",
  "readline",
  "worker_threads",
]);

const DEV_DEPENDENCIES = new Set([
  "vite",
  "typescript",
  "@vitejs/plugin-react",
  "tailwindcss",
  "@tailwindcss/vite",
  "eslint",
  "prettier",
  "vitest",
  "@types/react",
  "@types/react-dom",
  "@types/node",
]);

const DEFAULT_VERSIONS: Record<string, string> = {
  react: "latest",
  "react-dom": "latest",
  vite: "latest",
  typescript: "latest",
  "@vitejs/plugin-react": "latest",
  tailwindcss: "latest",
  "@tailwindcss/vite": "latest",
  "lucide-react": "latest",
  "framer-motion": "latest",
  motion: "latest",
  recharts: "latest",
  clsx: "latest",
  "class-variance-authority": "latest",
  "tailwind-merge": "latest",
  zod: "latest",
  express: "latest",
  cors: "latest",
  dotenv: "latest",
  openai: "latest",
  "@google/genai": "latest",
  jszip: "latest",
  "file-saver": "latest",
};

export function resolveProjectDependencies(files: VirtualFile[]): DependencyResolution {
  const packageFile = files.find((file) => normalizePath(file.path) === "/package.json");
  const warnings: string[] = [];

  let packageJson: any = null;

  if (packageFile?.content) {
    try {
      packageJson = JSON.parse(packageFile.content);
    } catch {
      warnings.push("package.json exists but is invalid JSON.");
    }
  }

  const usedPackages = detectUsedPackages(files);

  if (!packageJson) {
    packageJson = createDefaultPackageJson(usedPackages);
  }

  packageJson.name = packageJson.name || "forge-generated-app";
  packageJson.version = packageJson.version || "1.0.0";
  packageJson.private = packageJson.private ?? true;
  packageJson.type = packageJson.type || "module";

  packageJson.scripts = {
    dev: "vite",
    build: "vite build",
    preview: "vite preview",
    ...(packageJson.scripts || {}),
  };

  packageJson.dependencies = packageJson.dependencies || {};
  packageJson.devDependencies = packageJson.devDependencies || {};

  ensureBaseReactVite(packageJson);

  const declaredBefore = getDeclaredDependencies(packageJson);
  const missingDependencies = usedPackages.filter((pkg) => !declaredBefore.includes(pkg));

  for (const dep of missingDependencies) {
    if (DEV_DEPENDENCIES.has(dep)) {
      packageJson.devDependencies[dep] = DEFAULT_VERSIONS[dep] || "latest";
    } else {
      packageJson.dependencies[dep] = DEFAULT_VERSIONS[dep] || "latest";
    }
  }

  cleanupDependencyPlacement(packageJson);

  return {
    ok: missingDependencies.length === 0 && warnings.length === 0,
    packageJsonFound: Boolean(packageFile),
    usedPackages,
    declaredDependencies: getDeclaredDependencies(packageJson),
    missingDependencies,
    packageJson: JSON.stringify(packageJson, null, 2),
    warnings,
  };
}

export function applyDependencyResolution(files: VirtualFile[]): VirtualFile[] {
  const resolution = resolveProjectDependencies(files);

  if (!resolution.packageJson) return files;

  const next = new Map<string, VirtualFile>();

  for (const file of files) {
    next.set(normalizePath(file.path), {
      ...file,
      path: normalizePath(file.path),
    });
  }

  next.set("/package.json", {
    path: "/package.json",
    content: resolution.packageJson,
  });

  return Array.from(next.values()).sort((a, b) => a.path.localeCompare(b.path));
}

function normalizePath(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
}

function ensureBaseReactVite(packageJson: any) {
  packageJson.dependencies.react = packageJson.dependencies.react || "latest";
  packageJson.dependencies["react-dom"] = packageJson.dependencies["react-dom"] || "latest";

  packageJson.devDependencies.vite = packageJson.devDependencies.vite || "latest";
  packageJson.devDependencies.typescript = packageJson.devDependencies.typescript || "latest";
  packageJson.devDependencies["@vitejs/plugin-react"] =
    packageJson.devDependencies["@vitejs/plugin-react"] || "latest";
}

function createDefaultPackageJson(usedPackages: string[]) {
  const packageJson = {
    name: "forge-generated-app",
    version: "1.0.0",
    private: true,
    type: "module",
    scripts: {
      dev: "vite",
      build: "vite build",
      preview: "vite preview",
    },
    dependencies: {
      react: "latest",
      "react-dom": "latest",
    } as Record<string, string>,
    devDependencies: {
      vite: "latest",
      typescript: "latest",
      "@vitejs/plugin-react": "latest",
    } as Record<string, string>,
  };

  for (const dep of usedPackages) {
    if (DEV_DEPENDENCIES.has(dep)) {
      packageJson.devDependencies[dep] = DEFAULT_VERSIONS[dep] || "latest";
    } else {
      packageJson.dependencies[dep] = DEFAULT_VERSIONS[dep] || "latest";
    }
  }

  return packageJson;
}

function getDeclaredDependencies(packageJson: any) {
  if (!packageJson) return [];

  return [
    ...Object.keys(packageJson.dependencies || {}),
    ...Object.keys(packageJson.devDependencies || {}),
    ...Object.keys(packageJson.peerDependencies || {}),
  ].sort();
}

function cleanupDependencyPlacement(packageJson: any) {
  for (const dep of Object.keys(packageJson.dependencies || {})) {
    if (DEV_DEPENDENCIES.has(dep)) {
      packageJson.devDependencies[dep] =
        packageJson.devDependencies[dep] || packageJson.dependencies[dep];

      delete packageJson.dependencies[dep];
    }
  }

  for (const dep of Object.keys(packageJson.devDependencies || {})) {
    if (!DEV_DEPENDENCIES.has(dep) && packageJson.dependencies?.[dep]) {
      delete packageJson.devDependencies[dep];
    }
  }

  packageJson.dependencies = sortObject(packageJson.dependencies || {});
  packageJson.devDependencies = sortObject(packageJson.devDependencies || {});
  packageJson.scripts = sortObject(packageJson.scripts || {});
}

function sortObject(input: Record<string, string>) {
  return Object.fromEntries(Object.entries(input).sort(([a], [b]) => a.localeCompare(b)));
}

function detectUsedPackages(files: VirtualFile[]) {
  const packages = new Set<string>();

  for (const file of files) {
    if (!file.content) continue;
    if (!/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(file.path)) continue;

    const imports = extractImports(file.content);

    for (const item of imports) {
      const pkg = normalizePackageName(item);

      if (!pkg) continue;
      if (pkg.startsWith(".")) continue;
      if (pkg.startsWith("/")) continue;
      if (pkg.startsWith("@/")) continue;
      if (BUILTIN_MODULES.has(pkg)) continue;

      packages.add(pkg);
    }
  }

  return Array.from(packages).sort();
}

function extractImports(content: string) {
  const results = new Set<string>();

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
      results.add(match[1]);
    }
  }

  return Array.from(results);
}

function normalizePackageName(value: string) {
  if (!value || value.startsWith(".") || value.startsWith("/")) return null;

  if (value.startsWith("@")) {
    const parts = value.split("/");
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : value;
  }

  return value.split("/")[0];
  }
