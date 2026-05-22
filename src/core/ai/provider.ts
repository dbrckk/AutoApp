import { GoogleGenAI, HarmBlockThreshold, HarmCategory } from "@google/genai";
import OpenAI from "openai";
import type { AiCaller } from "../engine/types";

export function createAiCaller(aiConfig: any): AiCaller {
  const provider = aiConfig?.provider || "gemini";

  if (provider === "gemini") {
    return createGeminiCaller(aiConfig);
  }

  return createOpenAiCompatibleCaller(aiConfig);
}

function createGeminiCaller(aiConfig: any): AiCaller {
  const gemini = new GoogleGenAI({
    apiKey: aiConfig?.apiKey || process.env.GEMINI_API_KEY || "",
  });

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

        const status = error?.status || error?.code;
        const message = String(error?.message || "").toLowerCase();

        if (
          status === 429 ||
          status === 503 ||
          message.includes("429") ||
          message.includes("503") ||
          message.includes("quota") ||
          message.includes("unavailable")
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

function createOpenAiCompatibleCaller(aiConfig: any): AiCaller {
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
        const message = String(error?.message || "").toLowerCase();

        if (
          status === 429 ||
          status >= 500 ||
          message.includes("429") ||
          message.includes("rate limit") ||
          message.includes("temporarily unavailable")
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
