import type { VirtualFile } from "../engine/types";
import { scoreProject } from "../engine/scoring";
import { resolveProjectDependencies } from "./dependencyResolver";
import { inspectProject } from "./projectInspector";

export type PublishReport = {
  ready: boolean;
  score: number;
  qualityScore: number;
  blockers: string[];
  warnings: string[];
  checklist: string[];
  commands: string[];
};

export function createPublishReport(files: VirtualFile[]): PublishReport {
  const inspection = inspectProject(files);
  const dependencies = resolveProjectDependencies(files);
  const quality = scoreProject(files);

  const blockers: string[] = [];
  const warnings: string[] = [];

  if (inspection.framework === "Unknown") {
    blockers.push("Framework could not be detected.");
  }

  if (!inspection.entrypoints.length) {
    blockers.push("No valid app entrypoint detected.");
  }

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

  if (!files.some((file) => normalizePath(file.path) === "/vercel.json")) {
    warnings.push("Missing vercel.json for predictable Vercel deployment.");
  }

  if (!files.some((file) => normalizePath(file.path) === "/README.md")) {
    warnings.push("Missing README.md.");
  }

  if (!files.some((file) => normalizePath(file.path) === "/.env.example")) {
    warnings.push("Missing .env.example.");
  }

  if (quality.total < 75) {
    warnings.push(`Quality score is low: ${quality.total}/100.`);
  }

  if (quality.reliability < 75) {
    warnings.push(`Reliability score is low: ${quality.reliability}/100.`);
  }

  if (quality.mobile < 75) {
    warnings.push(`Mobile score is low: ${quality.mobile}/100.`);
  }

  if (quality.seo < 60) {
    warnings.push(`SEO score is low: ${quality.seo}/100.`);
  }

  warnings.push(...inspection.risks);

  const publishScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        quality.total -
          blockers.length * 18 -
          Math.min(warnings.length, 8) * 4
      )
    )
  );

  return {
    ready: blockers.length === 0 && publishScore >= 75,
    score: publishScore,
    qualityScore: quality.total,
    blockers: unique(blockers),
    warnings: unique(warnings),
    checklist: [
      "Run dependency resolver.",
      "Run real build check.",
      "Open real preview.",
      "Verify mobile layout.",
      "Verify SEO metadata.",
      "Add deployment pack if missing.",
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

function normalizePath(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
}

function unique(items: string[]) {
  return Array.from(new Set(items)).filter(Boolean);
      }
