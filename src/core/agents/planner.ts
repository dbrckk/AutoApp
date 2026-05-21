import type { GenerateInput } from "../engine/types";

export function buildPlannerPrompt(input: GenerateInput) {
  const mode = input.currentFiles?.length
    ? "IMPROVE_EXISTING_PROJECT"
    : "CREATE_NEW_PROJECT";

  const fileList =
    input.currentFiles?.length > 0
      ? input.currentFiles.map((file) => file.path).join("\n")
      : "No existing files.";

  return `
You are the PLANNER agent of Forge AI App Builder.

MODE:
${mode}

USER GOAL:
${input.prompt}

EXISTING FILES:
${fileList}

TASK:
Create a precise implementation plan before coding.

RETURN FORMAT:
Return ONLY valid JSON. No markdown. No commentary.

Required JSON shape:

{
  "summary": "short understanding of the project",
  "projectType": "saas | dashboard | affiliate | trading | mobile | ai-tool | website | unknown",
  "targetStack": ["React", "Vite", "TypeScript"],
  "architecture": {
    "entrypoints": ["file paths"],
    "components": ["component names"],
    "state": "short state management plan",
    "styling": "short styling plan",
    "data": "mock | local | api | unknown"
  },
  "requiredFiles": ["file paths that must exist"],
  "features": ["feature"],
  "implementationSteps": ["step"],
  "risks": ["risk"],
  "qualityBar": ["requirement"]
}

PLANNING RULES:
- Prefer React + Vite + TypeScript unless the existing project uses another stack.
- The app must be mobile-first.
- The app must be buildable with npm install && npm run build.
- Avoid unnecessary dependencies.
- If using icons, prefer lucide-react.
- If using animation, use framer-motion only when it improves UX.
- If the existing project is broken, prioritize build reliability.
- If this is an improvement, preserve current features.
- If this is a new app, create a minimal but complete app foundation.
- Required files should include package.json, index.html, vite config, src/main.tsx, src/App.tsx, and CSS when using Vite.
- Think like a senior product engineer.

OUTPUT ONLY JSON.
`;
}
