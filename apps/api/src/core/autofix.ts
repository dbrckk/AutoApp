import type { VirtualFile } from "./types";
import type { QualityGateResult } from "./qualityGate";
import { createBaseCss } from "./designSystem";

export type AutofixResult = {
  files: VirtualFile[];
  changes: string[];
};

export function applyAutofix(input: {
  files: VirtualFile[];
  quality: QualityGateResult;
}): AutofixResult {
  let files = [...input.files];
  const changes: string[] = [];

  if (!hasFile(files, "/src/index.css")) {
    files = upsertFile(files, { path: "/src/index.css", content: createBaseCss() });
    changes.push("Added /src/index.css with stable premium base styles.");
  }

  if (!hasFile(files, "/src/components/EmptyState.tsx")) {
    files = upsertFile(files, { path: "/src/components/EmptyState.tsx", content: createEmptyStateComponent() });
    changes.push("Added reusable EmptyState component.");
  }

  if (!hasFile(files, "/src/lib/storage.ts")) {
    files = upsertFile(files, { path: "/src/lib/storage.ts", content: createStorageHelper() });
    changes.push("Added safe localStorage helper.");
  }

  if (input.quality.categories.mobile < 70) {
    files = ensureCssRule(files, "html, body { overflow-x: hidden; }");
    changes.push("Added anti-horizontal-scroll CSS rule.");
  }

  return { files, changes };
}

function hasFile(files: VirtualFile[], path: string) {
  return files.some((file) => file.path === path);
}

function upsertFile(files: VirtualFile[], nextFile: VirtualFile) {
  const found = files.some((file) => file.path === nextFile.path);
  if (!found) return [...files, nextFile].sort((a, b) => a.path.localeCompare(b.path));
  return files.map((file) => (file.path === nextFile.path ? nextFile : file));
}

function ensureCssRule(files: VirtualFile[], rule: string) {
  const cssPath = "/src/index.css";
  const existing = files.find((file) => file.path === cssPath);

  if (!existing) {
    return upsertFile(files, { path: cssPath, content: rule });
  }

  const content = String(existing.content || "");
  if (content.includes(rule)) return files;

  return upsertFile(files, { path: cssPath, content: content.trim() + "\n\n" + rule + "\n" });
}

function createEmptyStateComponent() {
  return 'export function EmptyState({ title, message, action }: { title: string; message?: string; action?: React.ReactNode; }) {\n' +
    '  return (\n' +
    '    <section className="rounded-3xl border border-dashed border-white/15 bg-white/[0.03] p-8 text-center">\n' +
    '      <p className="text-lg font-black text-white">{title}</p>\n' +
    '      {message ? <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">{message}</p> : null}\n' +
    '      {action ? <div className="mt-5">{action}</div> : null}\n' +
    '    </section>\n' +
    '  );\n' +
    '}\n';
}

function createStorageHelper() {
  return 'export function readJson<T>(key: string, fallback: T): T {\n' +
    '  try {\n' +
    '    const raw = localStorage.getItem(key);\n' +
    '    if (!raw) return fallback;\n' +
    '    return JSON.parse(raw) as T;\n' +
    '  } catch {\n' +
    '    return fallback;\n' +
    '  }\n' +
    '}\n\n' +
    'export function writeJson<T>(key: string, value: T) {\n' +
    '  try {\n' +
    '    localStorage.setItem(key, JSON.stringify(value));\n' +
    '    return true;\n' +
    '  } catch {\n' +
    '    return false;\n' +
    '  }\n' +
    '}\n';
}
  
