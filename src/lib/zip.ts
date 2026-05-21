import JSZip from "jszip";
import { saveAs } from "file-saver";
import type { VirtualFile } from "../types";

function sanitizeFileName(name: string) {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, "-")
      .replace(/^-+|-+$/g, "") || "forge-project"
  );
}

function normalizePath(path: string) {
  return path.replace(/^\/+/, "");
}

export async function downloadZip(files: VirtualFile[], projectName = "forge-project") {
  const zip = new JSZip();

  for (const file of files) {
    if (!file.content) continue;

    const path = normalizePath(file.path);

    if (!path) continue;

    zip.file(path, file.content);
  }

  const blob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: {
      level: 6,
    },
  });

  saveAs(blob, `${sanitizeFileName(projectName)}.zip`);
}

export const downloadProjectAsZip = downloadZip;
