import type { VirtualFile } from "./types";

import { normalizePath } from "./files";

export type VirtualBuildResult = {

ok: boolean;

errors: string[];

warnings: string[];

missingImports: string[];

missingDependencies: string[];

invalidFiles: string[];

checkedAt: number;

summary: string;

};

const BUILTIN_MODULES = new Set([

"react",

"react-dom",

"react-dom/client",

"@vitejs/plugin-react",

"@tailwindcss/vite",

"vite",

]);

export function virtualBuildCheck(files: VirtualFile[]): VirtualBuildResult {

const normalized = normalizeFiles(files);

const paths = normalized.map((file) => normalizePath(file.path));

const fileMap = new Map(paths.map((path, index) => [path, normalized[index]]));

const errors: string[] = [];

const warnings: string[] = [];

const missingImports: string[] = [];

const missingDependencies: string[] = [];

const invalidFiles: string[] = [];

validateCriticalFiles({ paths, errors, warnings });

validatePackageJson({ fileMap, errors, warnings, missingDependencies });

validateViteProject({ fileMap, errors, warnings });

validateFiles({ files: normalized, invalidFiles, errors, warnings });

validateImports({ files: normalized, paths, missingImports, missingDependencies });

validateReactRuntime({ files: normalized, errors, warnings });

validateAndroidReadiness({ paths, fileMap, warnings });

const ok =

errors.length === 0 &&

invalidFiles.length === 0 &&

missingImports.length === 0 &&

missingDependencies.length === 0;

return {

ok,

errors,

warnings,

missingImports: Array.from(new Set(missingImports)),

missingDependencies: Array.from(new Set(missingDependencies)),

invalidFiles: Array.from(new Set(invalidFiles)),

checkedAt: Date.now(),

summary: ok

? "Static build check passed. This is not a real npm build."

: "Static build check found issues. Repair before deployment.",

};

}

export function resolveDependencies(files: VirtualFile[]) {

const normalized = normalizeFiles(files);

const packageFile = normalized.find(

(file) => normalizePath(file.path) === "/package.json"

);

const imports = collectExternalImports(normalized);

const addedDependencies: string[] = [];

const addedDevDependencies: string[] = [];

const warnings: string[] = [];

let packageJson: any = {};

if (packageFile?.content) {

try {

packageJson = JSON.parse(packageFile.content);

} catch {

warnings.push("package.json is invalid JSON.");

packageJson = {};

}

}

packageJson.private ??= true;

packageJson.type ||= "module";

packageJson.scripts ||= {};

packageJson.dependencies ||= {};

packageJson.devDependencies ||= {};

if (!packageJson.scripts.build) packageJson.scripts.build = "vite build";

if (!packageJson.scripts.dev) packageJson.scripts.dev = "vite --host 0.0.0.0";

if (!packageJson.scripts.preview) packageJson.scripts.preview = "vite preview --host 0.0.0.0";

ensureDep(packageJson.dependencies, "react", "latest", addedDependencies);

ensureDep(packageJson.dependencies, "react-dom", "latest", addedDependencies);

ensureDep(packageJson.devDependencies, "vite", "latest", addedDevDependencies);

ensureDep(packageJson.devDependencies, "@vitejs/plugin-react", "latest", addedDevDependencies);

ensureDep(packageJson.devDependencies, "typescript", "latest", addedDevDependencies);

for (const dependency of imports) {

if (dependency.startsWith(".") || dependency.startsWith("/")) continue;

const packageName = dependency.startsWith("@")

? dependency.split("/").slice(0, 2).join("/")

: dependency.split("/")[0];

addKnownDependency(packageJson, packageName, addedDependencies, addedDevDependencies);

}

return {

packageJson: {

path: "/package.json",

content: JSON.stringify(packageJson, null, 2),

},

addedDependencies: Array.from(new Set(addedDependencies)),

addedDevDependencies: Array.from(new Set(addedDevDependencies)),

warnings,

};

}

export function applyDependencyResolution(files: VirtualFile[], packageJson: VirtualFile | null) {

if (!packageJson) return files;

const nextFiles = [...files];

const index = nextFiles.findIndex((file) => normalizePath(file.path) === "/package.json");

if (index >= 0) nextFiles[index] = packageJson;

else nextFiles.unshift(packageJson);

return nextFiles;

}

function validateCriticalFiles({ paths, errors, warnings }: { paths: string[]; errors: string[]; warnings: string[] }) {

if (!paths.includes("/package.json")) errors.push("Missing /package.json.");

if (!paths.includes("/index.html")) errors.push("Missing /index.html.");

if (!paths.includes("/src/main.tsx") && !paths.includes("/src/main.jsx")) errors.push("Missing /src/main.tsx or /src/main.jsx.");

if (!paths.includes("/src/App.tsx") && !paths.includes("/src/App.jsx")) warnings.push("Missing /src/App.tsx or /src/App.jsx.");

}

function validatePackageJson({ fileMap, errors, warnings, missingDependencies }: { fileMap: Map<string, VirtualFile>; errors: string[]; warnings: string[]; missingDependencies: string[] }) {

const file = fileMap.get("/package.json");

if (!file?.content) return;

try {

const parsed = JSON.parse(file.content);

if (!parsed.scripts?.build) warnings.push("package.json missing scripts.build.");

if (!parsed.dependencies?.react) missingDependencies.push("react");

if (!parsed.dependencies?.["react-dom"]) missingDependencies.push("react-dom");

if (!parsed.devDependencies?.vite && !parsed.dependencies?.vite) missingDependencies.push("vite");

if (!parsed.devDependencies?.["@vitejs/plugin-react"] && !parsed.dependencies?.["@vitejs/plugin-react"]) missingDependencies.push("@vitejs/plugin-react");

} catch {

errors.push("package.json is invalid JSON.");

}

}

function validateViteProject({ fileMap, errors, warnings }: { fileMap: Map<string, VirtualFile>; errors: string[]; warnings: string[] }) {

const paths = Array.from(fileMap.keys());

const hasViteConfig = paths.includes("/vite.config.ts") || paths.includes("/vite.config.js");

if (!hasViteConfig) warnings.push("Missing vite.config.ts or vite.config.js.");

const index = fileMap.get("/index.html")?.content || "";

if (index && !index.includes("src/main")) errors.push("index.html does not reference /src/main.tsx or /src/main.jsx.");

}

function validateFiles({ files, invalidFiles, errors, warnings }: { files: VirtualFile[]; invalidFiles: string[]; errors: string[]; warnings: string[] }) {

const seen = new Set<string>();

for (const file of files) {

const path = normalizePath(file.path);

if (seen.has(path)) warnings.push(`Duplicate file path: ${path}`);

seen.add(path);

if (!path.startsWith("/")) invalidFiles.push(path);

if (file.content === null) continue;

const content = String(file.content || "");

if (!content.trim()) warnings.push(`Empty file: ${path}`);

if (/\.(tsx|ts|jsx|js)$/.test(path)) {

const balance = checkBalancedSyntax(content);

if (!balance.ok) errors.push(`${path}: ${balance.error}`);

if (content.includes("<<<<<<<") || content.includes("=======") || content.includes(">>>>>>>")) errors.push(`${path}: merge conflict markers found.`);

}

if (path.endsWith(".json")) {

try {

JSON.parse(content);

} catch {

errors.push(`${path}: invalid JSON.`);

}

}

}

}

function validateImports({ files, paths, missingImports, missingDependencies }: { files: VirtualFile[]; paths: string[]; missingImports: string[]; missingDependencies: string[] }) {

const packageJson = getPackageJson(files);

const availableDeps = new Set([

...Object.keys(packageJson.dependencies || {}),

...Object.keys(packageJson.devDependencies || {}),

...BUILTIN_MODULES,

]);

for (const file of files) {

const path = normalizePath(file.path);

const content = String(file.content || "");

if (!/\.(ts|tsx|js|jsx)$/.test(path)) continue;

for (const imported of extractImports(content)) {

if (imported.startsWith(".") || imported.startsWith("/")) {

const resolved = resolveLocalImport(path, imported, paths);

if (!resolved) missingImports.push(`${path} -> ${imported}`);

} else {

const packageName = imported.startsWith("@") ? imported.split("/").slice(0, 2).join("/") : imported.split("/")[0];

if (!availableDeps.has(packageName) && !availableDeps.has(imported)) missingDependencies.push(packageName);

}

}

}

}

function validateReactRuntime({ files, warnings }: { files: VirtualFile[]; errors: string[]; warnings: string[] }) {

const main = files.find((file) => ["/src/main.tsx", "/src/main.jsx"].includes(normalizePath(file.path)));

if (!main?.content) return;

if (!main.content.includes("createRoot")) warnings.push("main file does not use ReactDOM.createRoot.");

}

function validateAndroidReadiness({ paths, fileMap, warnings }: { paths: string[]; fileMap: Map<string, VirtualFile>; warnings: string[] }) {

const all = Array.from(fileMap.values()).map((file) => `${file.path}\n${file.content || ""}`).join("\n").toLowerCase();

if (!all.includes("android") && !all.includes("capacitor")) return;

if (!paths.includes("/ANDROID_BUILD.md")) warnings.push("Android target missing /ANDROID_BUILD.md.");

if (!paths.includes("/capacitor.config.ts") && !paths.includes("/capacitor.config.json")) warnings.push("Android target missing Capacitor config.");

if (!paths.includes("/public/manifest.webmanifest")) warnings.push("Android target missing web manifest.");

}

function collectExternalImports(files: VirtualFile[]) {

const imports = new Set<string>();

for (const file of files) {

const path = normalizePath(file.path);

if (!/\.(ts|tsx|js|jsx)$/.test(path)) continue;

for (const imported of extractImports(String(file.content || ""))) {

if (!imported.startsWith(".") && !imported.startsWith("/")) imports.add(imported);

}

}

return Array.from(imports);

}

function extractImports(content: string) {

const imports = new Set<string>();

const patterns = [/import\s+(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/g, /export\s+[\s\S]*?\s+from\s+["']([^"']+)["']/g, /import\(["']([^"']+)["']\)/g];

for (const pattern of patterns) {

let match: RegExpExecArray | null;

while ((match = pattern.exec(content))) imports.add(match[1]);

}

return Array.from(imports);

}

function resolveLocalImport(fromPath: string, imported: string, paths: string[]) {

const base = fromPath.split("/").slice(0, -1).join("/");

const raw = imported.startsWith("/") ? normalizePath(imported) : normalizePath(`${base}/${imported}`);

const normalized = normalizeSegments(raw);

const candidates = [normalized, `${normalized}.ts`, `${normalized}.tsx`, `${normalized}.js`, `${normalized}.jsx`, `${normalized}.json`, `${normalized}/index.ts`, `${normalized}/index.tsx`, `${normalized}/index.js`, `${normalized}/index.jsx`];

return candidates.find((candidate) => paths.includes(candidate));

}

function normalizeSegments(path: string) {

const parts: string[] = [];

for (const part of normalizePath(path).split("/")) {

if (!part || part === ".") continue;

if (part === "..") parts.pop();

else parts.push(part);

}

return `/${parts.join("/")}`;

}

function getPackageJson(files: VirtualFile[]) {

const packageFile = files.find((file) => normalizePath(file.path) === "/package.json");

if (!packageFile?.content) return {};

try {

return JSON.parse(packageFile.content);

} catch {

return {};

}

}

function ensureDep(deps: Record<string, string>, name: string, version: string, added: string[]) {

if (!deps[name]) {

deps[name] = version;

added.push(name);

}

}

function addKnownDependency(packageJson: any, packageName: string, addedDependencies: string[], addedDevDependencies: string[]) {

if (!packageName) return;

if (BUILTIN_MODULES.has(packageName)) return;

if (packageJson.dependencies?.[packageName]) return;

if (packageJson.devDependencies?.[packageName]) return;

const devPackages = new Set(["typescript", "vite", "@vitejs/plugin-react", "@tailwindcss/vite"]);

if (devPackages.has(packageName)) {

packageJson.devDependencies[packageName] = "latest";

addedDevDependencies.push(packageName);

} else {

packageJson.dependencies[packageName] = "latest";

addedDependencies.push(packageName);

}

}

function checkBalancedSyntax(content: string) {

const pairs: Record<string, string> = { "(": ")", "{": "}", "[": "]" };

const stack: string[] = [];

let inString: string | null = null;

let escaped = false;

for (const char of content) {

if (inString) {

if (escaped) {

escaped = false;

continue;

}

if (char === "\\") {

escaped = true;

continue;

}

if (char === inString) inString = null;

continue;

}

if (char === "\"" || char === "'" || char === "`") {

inString = char;

continue;

}

if (pairs[char]) stack.push(pairs[char]);

else if ([")", "}", "]"].includes(char)) {

const expected = stack.pop();

if (expected !== char) return { ok: false, error: `unbalanced syntax near '${char}'` };

}

}

if (stack.length) return { ok: false, error: `unclosed '${stack[stack.length - 1]}'` };

return { ok: true };

}

function normalizeFiles(files: VirtualFile[]) {

return (files || []).filter((file) => file && file.path);

}
