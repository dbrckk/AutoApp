import type { VirtualFile } from "./types";

export function createSmokeTestFiles(files: VirtualFile[]) {
  const hasPackage = files.some((file) => file.path === "/package.json");
  if (!hasPackage) return [];

  return [
    {
      path: "/src/__smoke__/project-smoke.test.ts",
      content: 'import { describe, expect, it } from "vitest";\n\ndescribe("project smoke", () => {\n  it("has a valid test environment", () => {\n    expect(true).toBe(true);\n  });\n});\n',
    },
  ] satisfies VirtualFile[];
}

export function createManualTestPlan(files: VirtualFile[]) {
  const paths = files.map((file) => file.path);

  return [
    "MANUAL TEST PLAN",
    "",
    "1. Install dependencies.",
    "2. Run the production build.",
    "3. Open the app on mobile width.",
    "4. Verify no horizontal scroll.",
    "5. Verify every primary button gives feedback.",
    "6. Verify loading, empty, and error states are visible.",
    "7. Verify local persistence after refresh.",
    "8. Verify export/copy/download flow if present.",
    "",
    "Detected files:",
    ...paths.map((path) => "- " + path),
  ].join("\n");
    }
