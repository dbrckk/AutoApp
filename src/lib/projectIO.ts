import type { Project } from "../types";

export function exportProjectAsJson(project: Project) {
  const payload = {
    version: "forge-project-v1",
    exportedAt: new Date().toISOString(),
    project,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `${sanitizeFileName(project.name)}.forge.json`;
  link.click();

  URL.revokeObjectURL(url);
}

export function readProjectJsonFile(file: File): Promise<Project> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || ""));

        if (parsed?.version !== "forge-project-v1") {
          throw new Error("Invalid Forge project file.");
        }

        if (!parsed.project?.id || !Array.isArray(parsed.project?.files)) {
          throw new Error("Invalid project payload.");
        }

        resolve(parsed.project);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error("Could not read project file."));
    };

    reader.readAsText(file);
  });
}

function sanitizeFileName(name: string) {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, "-")
      .replace(/^-+|-+$/g, "") || "forge-project"
  );
    }
