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
]);

const DEFAULT_VERSIONS: Record<string, string> = {
  "@vitejs/plugin-react": "latest",
  vite: "latest",
  typescript: "latest",
  react: "latest",
  "react-dom": "latest",
  tailwindcss: "latest",
  "@tailwindcss/vite": "latest",
  "lucide-react": "latest",
  "framer-motion": "latest",
  "motion": "latest",
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
  const declaredDependencies = getDeclaredDependencies(packageJson);
  const missingDependencies = usedPackages.filter(
    (pkg) => !declaredDependencies.includes(pkg)
  );

  if (!packageJson) {
    packageJson = createDefaultPackageJson(usedPackages);
  } else {
    packageJson.dependencies = packageJson.dependencies || {};

    for (const dep of missingDependencies) {
      packageJson.dependencies[dep] = DEFAULT_VERSIONS[dep] || "latest";
    }

    packageJson.scripts = {
      dev: packageJson.scripts?.dev || "vite",
      build: packageJson.scripts?.build || "vite build",
      preview: packageJson.scripts?.preview || "vite preview",
      ...packageJson.scripts,
    };
  }

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

function createDefaultPackageJson(usedPackages: string[]) {
  const dependencies: Record<string, string> = {
    react: "latest",
    "react-dom": "latest",
  };

  const devDependencies: Record<string, string> = {
    "@vitejs/plugin-react": "latest",
    vite: "latest",
    typescript: "latest",
  };

  for (const dep of usedPackages) {
    if (dep === "vite" || dep === "typescript" || dep === "@vitejs/plugin-react") {
      devDependencies[dep] = DEFAULT_VERSIONS[dep] || "latest";
    } else {
      dependencies[dep] = DEFAULT_VERSIONS[dep] || "latest";
    }
  }

  return {
    name: "forge-generated-app",
    version: "1.0.0",
    private: true,
    type: "module",
    scripts: {
      dev: "vite",
      build: "vite build",
      preview: "vite preview",
    },
    dependencies,
    devDependencies,
  };
}

function getDeclaredDependencies(packageJson: any) {
  if (!packageJson) return [];

  return [
    ...Object.keys(packageJson.dependencies || {}),
    ...Object.keys(packageJson.devDependencies || {}),
    ...Object.keys(packageJson.peerDependencies || {}),
  ];
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
