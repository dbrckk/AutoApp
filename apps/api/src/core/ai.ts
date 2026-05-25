import type { AiConfig, Env, VirtualFile } from "./types";

export async function callAiJson(
  env: Env,
  aiConfig: AiConfig | undefined,
  prompt: string
) {
  const provider = aiConfig?.provider || env.DEFAULT_AI_PROVIDER || "gemini";

  if (provider === "gemini") {
    return callGemini(env, aiConfig, prompt);
  }

  return callOpenAiCompatible(env, aiConfig, prompt);
}

export async function callGemini(
  env: Env,
  aiConfig: AiConfig | undefined,
  prompt: string
) {
  const key = aiConfig?.apiKey || env.GEMINI_API_KEY;

  if (!key) {
    throw new Error("Missing GEMINI_API_KEY.");
  }

  const model =
    aiConfig?.model || env.DEFAULT_GEMINI_MODEL || "gemini-2.5-flash";

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.25,
          responseMimeType: "application/json",
        },
      }),
    }
  );

  const data: any = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || "Gemini request failed.");
  }

  return parseJson(
    data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}"
  );
}

export async function callOpenAiCompatible(
  env: Env,
  aiConfig: AiConfig | undefined,
  prompt: string
) {
  const key = aiConfig?.apiKey || env.OPENAI_API_KEY;

  if (!key) {
    throw new Error("Missing OPENAI_API_KEY.");
  }

  const baseUrl =
    aiConfig?.baseUrl || env.OPENAI_BASE_URL || "https://api.openai.com/v1";

  const model =
    aiConfig?.model || env.DEFAULT_OPENAI_MODEL || "gpt-4o-mini";

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.25,
      response_format: {
        type: "json_object",
      },
      messages: [
        {
          role: "system",
          content: "Return ONLY valid JSON. No markdown.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  const data: any = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || "OpenAI-compatible request failed.");
  }

  return parseJson(data?.choices?.[0]?.message?.content || "{}");
}

export function parseJson(text: string) {
  const cleaned = String(text || "")
    .trim()
    .replace(/^```json/i, "")
    .replace(/^```/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const objectStart = cleaned.indexOf("{");
    const objectEnd = cleaned.lastIndexOf("}");

    if (objectStart >= 0 && objectEnd > objectStart) {
      try {
        return JSON.parse(cleaned.slice(objectStart, objectEnd + 1));
      } catch {
        return fallbackAiOutput();
      }
    }

    const arrayStart = cleaned.indexOf("[");
    const arrayEnd = cleaned.lastIndexOf("]");

    if (arrayStart >= 0 && arrayEnd > arrayStart) {
      try {
        return {
          files: JSON.parse(cleaned.slice(arrayStart, arrayEnd + 1)),
          changelog: "Parsed JSON array response.",
          estimatedTimeSaved: "Several hours saved.",
        };
      } catch {
        return fallbackAiOutput();
      }
    }

    return fallbackAiOutput();
  }
}

export function fallbackAiOutput() {
  return {
    files: createFallbackProjectFiles(),
    changelog: "AI returned invalid JSON. Safe fallback project generated.",
    estimatedTimeSaved: "Fallback recovery",
  };
}

export function createFallbackProjectFiles(): VirtualFile[] {
  return [
    {
      path: "/package.json",
      content: JSON.stringify(
        {
          name: "autoapp-generated-project",
          version: "1.0.0",
          private: true,
          type: "module",
          scripts: {
            dev: "vite",
            build: "vite build",
            preview: "vite preview",
          },
          dependencies: {
            "@tailwindcss/vite": "latest",
            react: "latest",
            "react-dom": "latest",
          },
          devDependencies: {
            "@vitejs/plugin-react": "latest",
            typescript: "latest",
            vite: "latest",
          },
        },
        null,
        2
      ),
    },
    {
      path: "/index.html",
      content:
        '<!doctype html><html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>AutoApp Generated Project</title><meta name="description" content="Generated with AutoApp." /></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>',
    },
    {
      path: "/vite.config.ts",
      content:
        'import { defineConfig } from "vite";\nimport react from "@vitejs/plugin-react";\nimport tailwindcss from "@tailwindcss/vite";\n\nexport default defineConfig({ plugins: [react(), tailwindcss()] });\n',
    },
    {
      path: "/tsconfig.json",
      content: JSON.stringify(
        {
          compilerOptions: {
            target: "ES2020",
            useDefineForClassFields: true,
            lib: ["DOM", "DOM.Iterable", "ES2020"],
            allowJs: false,
            skipLibCheck: true,
            esModuleInterop: true,
            allowSyntheticDefaultImports: true,
            strict: true,
            forceConsistentCasingInFileNames: true,
            module: "ESNext",
            moduleResolution: "Node",
            resolveJsonModule: true,
            isolatedModules: true,
            noEmit: true,
            jsx: "react-jsx",
          },
          include: ["src"],
        },
        null,
        2
      ),
    },
    {
      path: "/src/main.tsx",
      content:
        'import React from "react";\nimport ReactDOM from "react-dom/client";\nimport App from "./App";\nimport "./style.css";\n\nReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);\n',
    },
    {
      path: "/src/App.tsx",
      content:
        'export default function App() {\n  return <main className="min-h-screen bg-[#050505] px-6 py-16 text-white"><section className="mx-auto max-w-5xl rounded-3xl border border-white/10 bg-white/[0.04] p-8 shadow-2xl"><p className="text-xs uppercase tracking-[0.35em] text-zinc-500">AutoApp</p><h1 className="mt-4 text-5xl font-black tracking-tight md:text-7xl">Generated app recovered safely.</h1><p className="mt-6 max-w-2xl text-zinc-400">The AI response was invalid, so AutoApp generated a safe buildable fallback project.</p></section></main>;\n}\n',
    },
    {
      path: "/src/style.css",
      content:
        '@import "tailwindcss";\n\n* { box-sizing: border-box; }\nbody { margin: 0; background: #050505; color: white; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }\n',
    },
  ];
  }
