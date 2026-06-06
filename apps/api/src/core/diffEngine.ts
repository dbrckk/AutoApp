import type { VirtualFile } from "./types";

export type FileDiff = {
  path: string;
  status: "added" | "modified" | "deleted" | "unchanged";
  beforeLines: number;
  afterLines: number;
  lineDelta: number;
  charDelta: number;
  summary: string;
};

export type DiffSummary = {
  changedFiles: number;
  added: number;
  modified: number;
  deleted: number;
  totalLineDelta: number;
  totalCharDelta: number;
  diffs: FileDiff[];
};

export function createDiffSummary(before: VirtualFile[], after: VirtualFile[]): DiffSummary {
  const beforeMap = new Map(before.map((file) => [file.path, file]));
  const afterMap = new Map(after.map((file) => [file.path, file]));
  const paths = Array.from(new Set([...beforeMap.keys(), ...afterMap.keys()])).sort();

  const diffs = paths.map((path) => {
    const previous = beforeMap.get(path);
    const next = afterMap.get(path);

    if (!previous && next) return createFileDiff(path, "added", "", next.content || "");
    if (previous && !next) return createFileDiff(path, "deleted", previous.content || "", "");
    if (previous && next && previous.content !== next.content) {
      return createFileDiff(path, "modified", previous.content || "", next.content || "");
    }

    return createFileDiff(path, "unchanged", previous?.content || "", next?.content || "");
  });

  const changed = diffs.filter((diff) => diff.status !== "unchanged");

  return {
    changedFiles: changed.length,
    added: diffs.filter((diff) => diff.status === "added").length,
    modified: diffs.filter((diff) => diff.status === "modified").length,
    deleted: diffs.filter((diff) => diff.status === "deleted").length,
    totalLineDelta: changed.reduce((sum, diff) => sum + diff.lineDelta, 0),
    totalCharDelta: changed.reduce((sum, diff) => sum + diff.charDelta, 0),
    diffs,
  };
}

function createFileDiff(path: string, status: FileDiff["status"], before: string, after: string): FileDiff {
  const beforeLines = before ? before.split("\n").length : 0;
  const afterLines = after ? after.split("\n").length : 0;

  return {
    path,
    status,
    beforeLines,
    afterLines,
    lineDelta: afterLines - beforeLines,
    charDelta: after.length - before.length,
    summary: summarizeChange(status, before, after),
  };
}

function summarizeChange(status: FileDiff["status"], before: string, after: string) {
  if (status === "added") return "New file added.";
  if (status === "deleted") return "File deleted.";
  if (status === "unchanged") return "No change.";

  const notes: string[] = [];

  if (after.length > before.length) notes.push("expanded");
  if (after.length < before.length) notes.push("reduced");
  if (/loading|error|empty/i.test(after) && !/loading|error|empty/i.test(before)) notes.push("state handling added");
  if (/localStorage|indexedDB/i.test(after) && !/localStorage|indexedDB/i.test(before)) notes.push("persistence added");
  if (/sm:|md:|lg:|@media/i.test(after) && !/sm:|md:|lg:|@media/i.test(before)) notes.push("responsive behavior added");

  return notes.length ? notes.join(", ") : "Content modified.";
      }
  
