import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import {
  GoogleGenAI,
  HarmBlockThreshold,
  HarmCategory,
} from "@google/genai";
import OpenAI from "openai";

import { orchestrateGeneration } from "./src/core/engine/orchestration";
import type { AiCaller } from "./src/core/engine/types";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(express.json({ limit: "75mb" }));
app.use(express.urlencoded({ limit: "75mb", extended: true }));

const gemini = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
});

function createAiCaller(aiConfig: any): AiCaller {
  const provider = aiConfig?.provider || "gemini";

  if (provider === "gemini") {
    return async (prompt: string) => {
      const models = [
        aiConfig?.model,
        "gemini-2.5-flash",
        "gemini-2.5-pro",
        "gemini-1.5-pro",
        "gemini-1.5-flash",
      ].filter(Boolean);

      let lastError: unknown;

      for (const model of models) {
        try {
          const response = await gemini.models.generateContent({
            model,
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              temperature: 0.2,
              maxOutputTokens: 8192,
              safetySettings: [
                {
                  category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                  threshold: HarmBlockThreshold.BLOCK_NONE,
                },
                {
                  category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                  threshold: HarmBlockThreshold.BLOCK_NONE,
                },
                {
                  category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                  threshold: HarmBlockThreshold.BLOCK_NONE,
                },
                {
                  category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                  threshold: HarmBlockThreshold.BLOCK_NONE,
                },
              ],
            },
          });

          return {
            text: response.text || "",
            raw: response,
          };
        } catch (error: any) {
          lastError = error;

          const message = String(error?.message || "");
          const status = error?.status || error?.code;

          if (
            status === 429 ||
            status === 503 ||
            message.includes("429") ||
            message.includes("503") ||
            message.toLowerCase().includes("quota") ||
            message.toLowerCase().includes("unavailable")
          ) {
            continue;
          }

          throw error;
        }
      }

      throw new Error(
        `Gemini failed across fallback models. Last error: ${
          lastError instanceof Error ? lastError.message : String(lastError)
        }`
      );
    };
  }

  return async (prompt: string) => {
    const openai = new OpenAI({
      apiKey: aiConfig?.apiKey || process.env.OPENAI_API_KEY || "",
      baseURL: aiConfig?.baseUrl || undefined,
    });

    const requestedModel = aiConfig?.model || "llama-3.3-70b-versatile";

    const fallbackModels = [
      requestedModel,
      "llama-3.3-70b-versatile",
      "llama-3.1-8b-instant",
      "mixtral-8x7b-32768",
      "gemma2-9b-it",
    ].filter((model, index, arr) => model && arr.indexOf(model) === index);

    let lastError: unknown;

    for (const model of fallbackModels) {
      try {
        const completion = await openai.chat.completions.create({
          model,
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                "You are Forge AI. Return ONLY valid JSON. No markdown. No commentary.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
        });

        return {
          text: completion.choices[0]?.message?.content || "",
          raw: completion,
        };
      } catch (error: any) {
        lastError = error;

        const status = error?.status || 500;
        const message = String(error?.message || "");

        if (
          status === 429 ||
          status >= 500 ||
          message.includes("429") ||
          message.toLowerCase().includes("rate limit") ||
          message.toLowerCase().includes("temporarily unavailable")
        ) {
          continue;
        }

        throw error;
      }
    }

    throw new Error(
      `OpenAI-compatible provider failed across fallback models. Last error: ${
        lastError instanceof Error ? lastError.message : String(lastError)
      }`
    );
  };
}

function cleanFiles(files: any[]) {
  if (!Array.isArray(files)) return [];

  let totalChars = 0;
  const MAX_CONTEXT_CHARS = 500_000;

  return files
    .filter((file) => {
      const pathValue = String(file?.path || "");

      return (
        pathValue &&
        !pathValue.endsWith("package-lock.json") &&
        !pathValue.endsWith("yarn.lock") &&
        !pathValue.endsWith("pnpm-lock.yaml") &&
        !pathValue.includes("node_modules") &&
        !pathValue.includes(".git/")
      );
    })
    .map((file) => {
      const filePath = String(file.path || "");
      const content = String(file.content || "");

      const isBinaryLike =
        filePath.endsWith(".svg") ||
        filePath.endsWith(".png") ||
        filePath.endsWith(".jpg") ||
        filePath.endsWith(".jpeg") ||
        filePath.endsWith(".webp") ||
        filePath.endsWith(".gif") ||
        filePath.endsWith(".ico") ||
        filePath.endsWith(".mp4") ||
        filePath.endsWith(".mp3") ||
        filePath.endsWith(".wav") ||
        filePath.endsWith(".zip");

      const isLarge = content.length > 60_000 || isBinaryLike;

      if (isLarge) {
        return {
          path: filePath,
          content: "// Content omitted because file is too large or binary-like.",
        };
      }

      if (totalChars + content.length > MAX_CONTEXT_CHARS) {
        return {
          path: filePath,
          content: "// Content omitted to stay inside model context limits.",
        };
      }

      totalChars += content.length;

      return {
        path: filePath,
        content,
      };
    });
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    name: "Forge AI App Builder",
    version: "2.1-real-build-runner",
  });
});

app.post("/api/generate", async (req, res) => {
  try {
    const {
      prompt,
      currentFiles,
      isAutoImprove,
      aiConfig,
      buildMode,
    } = req.body;

    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({
        error: "Missing required field: prompt",
      });
    }

    const cleanedFiles = cleanFiles(currentFiles);
    const callAi = createAiCaller(aiConfig);

    const output = await orchestrateGeneration(
      {
        prompt,
        currentFiles: cleanedFiles,
        isAutoImprove: Boolean(isAutoImprove),
        aiConfig,
        buildMode: buildMode || "virtual",
      },
      callAi
    );

    res.json(output);
  } catch (error: any) {
    console.error("[/api/generate] Error:", error);

    res.status(500).json({
      error: error?.message || "Unknown generation error",
      details:
        process.env.NODE_ENV === "production"
          ? undefined
          : String(error?.stack || error),
    });
  }
});

app.post("/api/build-check", async (req, res) => {
  try {
    const { files, mode } = req.body;

    if (!Array.isArray(files)) {
      return res.status(400).json({
        error: "Missing required field: files",
      });
    }

    const cleanedFiles = cleanFiles(files);

    if (mode === "real") {
      const { runRealBuild } = await import(
        "./src/core/sandbox/realBuildRunner"
      );

      const result = await runRealBuild(cleanedFiles);
      return res.json(result);
    }

    const { virtualBuildCheck } = await import(
      "./src/core/sandbox/virtualBuild"
    );

    const result = virtualBuildCheck(cleanedFiles);
    return res.json(result);
  } catch (error: any) {
    console.error("[/api/build-check] Error:", error);

    res.status(500).json({
      error: error?.message || "Build check failed",
      details:
        process.env.NODE_ENV === "production"
          ? undefined
          : String(error?.stack || error),
    });
  }
});

app.post("/api/score", async (req, res) => {
  try {
    const { files } = req.body;

    if (!Array.isArray(files)) {
      return res.status(400).json({
        error: "Missing required field: files",
      });
    }

    const { scoreProject } = await import("./src/core/engine/scoring");
    const score = scoreProject(cleanFiles(files));

    res.json({
      ok: true,
      score,
    });
  } catch (error: any) {
    console.error("[/api/score] Error:", error);

    res.status(500).json({
      error: error?.message || "Score failed",
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
      },
      appType: "spa",
    });

    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");

    app.use(express.static(distPath));

    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Forge server running on http://localhost:${PORT}`);
  });

  server.setTimeout(600_000);
}

startServer();
