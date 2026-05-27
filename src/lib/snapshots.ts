import type { VirtualFile } from "../types";

export type ProjectSnapshot = {
  id: string;
  name: string;
  createdAt: number;
  files: VirtualFile[];
};

const STORAGE_KEY = "autoapp.snapshots.v1";

export function listSnapshots(): ProjectSnapshot[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveSnapshot(name: string, files: VirtualFile[]) {
  const snapshots = listSnapshots();

  const snapshot: ProjectSnapshot = {
    id: crypto.randomUUID(),
    name,
    createdAt: Date.now(),
    files,
  };

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify([snapshot, ...snapshots].slice(0, 30))
  );

  return snapshot;
}

export function deleteSnapshot(id: string) {
  const snapshots = listSnapshots().filter((item) => item.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshots));
  return snapshots;
}

export function clearSnapshots() {
  localStorage.removeItem(STORAGE_KEY);
}
