import type { VirtualFile } from "./types";

export function cleanFiles(files: unknown): VirtualFile[] {
  if (!Array.isArray(files)) return [];

  return files
    .filter((file: any) => file?.path)
    .map((file: any) => ({
      path: normalizePath(String(file.path)),
      content: file.content === null ? null : String(file.content || ""),
    }))
    .filter(
      (file) =>
        !file.path.includes("node_modules") &&
        !file.path.includes(".git/")
    );
}

export function normalizeGeneratedFiles(files: unknown): VirtualFile[] {
  if (!Array.isArray(files)) return [];

  const seen = new Set<string>();

  return files
    .filter((file: any) => file?.path)
    .map((file: any) => ({
      path: normalizePath(String(file.path)),
      content: file.content === null ? null : String(file.content || ""),
    }))
    .filter((file) => {
      if (seen.has(file.path)) return false;
      seen.add(file.path);
      return true;
    });
}

export function mergeFiles(
  currentFiles: VirtualFile[],
  changedFiles: VirtualFile[]
): VirtualFile[] {
  const map = new Map<string, VirtualFile>();

  for (const file of currentFiles || []) {
    map.set(normalizePath(file.path), {
      path: normalizePath(file.path),
      content: file.content,
    });
  }

  for (const file of changedFiles || []) {
    const path = normalizePath(file.path);

    if (file.content === null) {
      map.delete(path);
    } else {
      map.set(path, {
        path,
        content: file.content,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    a.path.localeCompare(b.path)
  );
}

export function diffFiles(
  previous: VirtualFile[],
  next: VirtualFile[]
): VirtualFile[] {
  const previousMap = new Map(
    previous.map((file) => [normalizePath(file.path), file.content])
  );

  return next.filter(
    (file) => previousMap.get(normalizePath(file.path)) !== file.content
  );
}

export function normalizePath(path: string): string {
  const value = String(path || "").trim();
  return value.startsWith("/") ? value : `/${value}`;
}

export function serializeFiles(files: VirtualFile[]): string {
  return JSON.stringify(
    files.slice(0, 22).map((file) => ({
      path: file.path,
      content: String(file.content || "").slice(0, 12_000),
    })),
    null,
    2
  );
}

export function safeJsonArray(value: string | null | undefined): any[] {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function readPackageJson(files: VirtualFile[]): any | null {
  const file = files.find((item) => normalizePath(item.path) === "/package.json");

  if (!file?.content) return null;

  try {
    return JSON.parse(file.content);
  } catch {
    return null;
  }
}

export function normalizePackageName(value: string): string | null {
  if (!value || value.startsWith(".") || value.startsWith("/")) return null;

  if (value.startsWith("@")) {
    const parts = value.split("/");
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : value;
  }

  return value.split("/")[0];
}

export function sortObject(input: Record<string, any>): Record<string, any> {
  return Object.fromEntries(
    Object.entries(input || {}).sort(([a], [b]) => a.localeCompare(b))
  );
}

export function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}
