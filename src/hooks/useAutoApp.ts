import { useEffect, useMemo, useState } from "react";

import type { VirtualFile } from "../types";

import { exportFilesAsZip } from "../lib/exportZip";

import {
  deleteSnapshot,
  listSnapshots,
  saveSnapshot,
  type ProjectSnapshot,
} from "../lib/snapshots";

import {
  applyTemplate,
  checkApiHealth,
  checkBuild,
  createDeploymentPack,
  createPublishReport,
  deleteAutonomousJob,
  exportToGitHub,
  generateProject,
  getAutonomousJobFiles,
  getAutonomousJobLogs,
  getAutonomousJobReport,
  getDiagnostics,
  getGitHubFileStatus,
  getGitHubHistory,
  getLatestGitHubCommit,
  getLiveDiagnostics,
  improveAutonomousJob,
  inspectProject,
  listAutonomousJobs,
  listTemplates,
  resolveDependencies,
  resumeAutonomousJob,
  runAutonomousJobStep,
  scoreProject,
  startRealAutonomousJob,
  testGeminiApi,
  testGitHubAccess,
  testGitHubExport,
  type AutonomousJob,
} from "../lib/api";

const SAMPLE_PROMPT = `Create a premium production-ready mobile-first SaaS dashboard for creators.

The app must feel like a real shipped product, not a demo. It needs onboarding, dashboard, analytics, settings, export actions, empty/loading/error states, persistent local state, polished responsive UI, clear navigation, premium dark design, and production-ready code.

auto improve forever: true`;

const PRODUCT_DIRECTIVE = `
PROFESS
