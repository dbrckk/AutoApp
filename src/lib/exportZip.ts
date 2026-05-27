import JSZip from "jszip";
import { saveAs } from "file-saver";

import type { VirtualFile } from "../types";

export async function exportFilesAsZip(files: VirtualFile[], name = "autoapp-export") {
  const zip = new JSZip();

  for (const file of files) {
    if (!file.path || file.content === null) continue;

    const cleanPath = file.path.replace(/^\/+/, "");
    zip.file(cleanPath, file.content);
  }

  const blob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: {
      level: 6,
    },
  });

  saveAs(blob, `${name}.zip`);
}
