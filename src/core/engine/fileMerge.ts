import type { VirtualFile } from "./types";

export function normalizePath(path: string) {
  if (!path) return "/";
  return path.startsWith("/") ? path : `/${path}`;
}

export function mergeFiles(currentFiles: VirtualFile[], generatedFiles: VirtualFile[]) {
  const map = new Map<string, VirtualFile>();

  for (const file of currentFiles) {
    map.set(normalizePath(file.path), {
      ...file,
      path: normalizePath(file.path),
    });
  }

  for (const file of generatedFiles) {
    const path = normalizePath(file.path);

    if (file.content === null) {
      map.delete(path);
      continue;
    }

    map.set(path, {
      path,
      content: file.content,
    });
  }

  return Array.from(map.values()).sort((a, b) => a.path.localeCompare(b.path));
}
