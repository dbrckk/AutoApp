import type { AiConfig, Env, VirtualFile } from "./types";

export async function callAiJson(
  env: Env,
  aiConfig: AiConfig | undefined,
  prompt: string
) {
  const provider = String(
    aiConfig?.provider || env.DEFAULT_AI_PROVIDER || "groq"
  ).toLowerCase();

  if (provider === "gemini") {
    return callGemini(env, aiConfig, prompt);
  }

  if (provider === "groq") {
    return callGroq(env, aiConfig, prompt);
  }

  return callOpenAiCompatible(env, aiConfig, prompt);
}

export async function callGemini(
  env: Env,
  aiConfig: AiConfig | undefined,
  prompt: string
) {
  const key = aiConfig?.apiKey || env.GEMINI_API_KEY;
  if (!key) throw new Error("Missing GEMINI_API_KEY.");

  const model =
    aiConfig?.model || env.DEFAULT_GEMINI_MODEL || "gemini-2.5-flash";

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
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

  return parseJson(data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}");
}

export async function callGroq(
  env: Env,
  aiConfig: AiConfig | undefined,
  prompt: string
) {
  const key = aiConfig?.apiKey || env.GROQ_API_KEY;
  if (!key) throw new Error("Missing GROQ_API_KEY.");

  const baseUrl = aiConfig?.baseUrl || "https://api.groq.com/openai/v1";
  const model =
    aiConfig?.model || env.DEFAULT_GROQ_MODEL || "llama-3.3-70b-versatile";

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Return ONLY valid JSON. No markdown. No code fences. The JSON must contain a files array when code is requested.",
        },
        {
          role: "user",
          content: prompt,
        },
