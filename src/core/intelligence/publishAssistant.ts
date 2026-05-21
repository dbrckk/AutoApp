import { inspectProject } from "./projectInspector";
import { resolveProjectDependencies } from "./dependencyResolver";
import type { VirtualFile } from "../engine/types";

export type PublishReport = {
  ready: boolean;
  score: number;
  blockers: string[];
  warnings: string[];
  checklist: string[];
  commands: string[];
};

export function createPublishReport(files: VirtualFile[]): PublishReport {
  const inspection = inspectProject(files);
  const dependencies = resolveProjectDependencies(files);

  const blockers: string[] = [];
  const warnings: string[] = [];

  if (inspection.missingCriticalFiles.length > 0) {
    blockers.push(
      `Missing critical files: ${inspection.missingCriticalFiles.join(", ")}`
    );
  }

  if (dependencies.missingDependencies.length > 0) {
    blockers.push(
      `Missing dependencies: ${dependencies.missingDependencies.join(", ")}`
    );
  }

  if (!inspection.entrypoints.length) {
    blockers.push("No valid app entrypoint detected.");
  }

  if (inspection.framework === "Unknown") {
    blockers.push("Framework could not be detected.");
  }

  if (inspection.risks.length > 0) {
    warnings.push(...inspection.risks);
  }

  const score = Math.max(
    0,
    100 -
      blockers.length * 22 -
      warnings.length * 6 -
      inspection.missingCriticalFiles.length * 8
  );

  return {
    ready: blockers.length === 0 && score >= 75,
    score,
    blockers,
    warnings,
    checklist: [
      "Run dependency resolver.",
      "Run real build check.",
      "Open real preview.",
      "Verify mobile layout.",
      "Verify SEO metadata.",
      "Export ZIP.",
      "Push to GitHub.",
      "Deploy on Vercel.",
    ],
    commands: [
      "npm install",
      "npm run build",
      "git init",
      "git add .",
      'git commit -m "Initial Forge generated app"',
      "git branch -M main",
      "git remote add origin YOUR_GITHUB_REPO_URL",
      "git push -u origin main",
    ],
  };
      }
