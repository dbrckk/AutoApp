import type { VirtualFile } from "../types";

const SESSION_KEY = "autoapp.frontend.snapshot.v1";

export type FrontendSessionSnapshot = {

savedAt: number;

activeJobId: string;

selectedPath: string;

files: VirtualFile[];

projectReport: any;

jobLogs: string[];

};

export function saveFrontendSnapshot(snapshot: Omit<FrontendSessionSnapshot, "savedAt">) {

try {

const payload: FrontendSessionSnapshot = {

...snapshot,

savedAt: Date.now(),

files: Array.isArray(snapshot.files) ? snapshot.files.slice(0, 250) : [],

jobLogs: Array.isArray(snapshot.jobLogs) ? snapshot.jobLogs.slice(0, 300) : [],

};

localStorage.setItem(SESSION_KEY, JSON.stringify(payload));

return true;

} catch {

return false;

}

}

export function readFrontendSnapshot(): FrontendSessionSnapshot | null {

try {

const raw = localStorage.getItem(SESSION_KEY);

if (!raw) return null;

const parsed = JSON.parse(raw);

if (!parsed || typeof parsed !== "object") return null;

return {

savedAt: Number(parsed.savedAt || 0),

activeJobId: String(parsed.activeJobId || ""),

selectedPath: String(parsed.selectedPath || ""),

files: Array.isArray(parsed.files) ? parsed.files : [],

projectReport: parsed.projectReport || null,

jobLogs: Array.isArray(parsed.jobLogs) ? parsed.jobLogs : [],

};

} catch {

return null;

}

}

export function clearFrontendSnapshot() {

try {

localStorage.removeItem(SESSION_KEY);

return true;

} catch {

return false;

}

}

export function isFreshSnapshot(snapshot: FrontendSessionSnapshot | null) {

if (!snapshot) return false;

const ageMs = Date.now() - Number(snapshot.savedAt || 0);

return ageMs >= 0 && ageMs <= 1000 * 60 * 60 * 24;

                                }
