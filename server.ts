import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, HarmBlockThreshold, HarmCategory } from "@google/genai";
import OpenAI from "openai";

import { orchestrateGeneration } from "./src/core/engine/orchestration";
import {
  cleanupOldJobs,
  createJob,
  getJob,
  pushJobLog,
  updateJob,
} from "./src/core/engine/jobStore";
import type { AiCaller } from "./src/core/engine/types";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ limit: "100mb", extended: true }));

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
  const MAX_CONTEXT_CHARS = 650_000;

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

      const isLarge = content.length > 80_000
