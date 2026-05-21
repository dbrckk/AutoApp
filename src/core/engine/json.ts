import { jsonrepair } from "jsonrepair";

export function parseAiJson<T = any>(text: string): T {
  const cleaned = extractJson(text);

  try {
    return JSON.parse(cleaned);
  } catch {
    return JSON.parse(jsonrepair(cleaned));
  }
}

export function extractJson(text: string) {
  if (!text || typeof text !== "string") {
    throw new Error("AI response is empty.");
  }

  let cleaned = text
    .trim()
    .replace(/^\uFEFF/, "")
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  const objectStart = cleaned.indexOf("{");
  const arrayStart = cleaned.indexOf("[");

  const starts = [objectStart, arrayStart].filter((index) => index >= 0);

  if (starts.length === 0) {
    throw new Error("AI response does not contain JSON.");
  }

  const start = Math.min(...starts);
  cleaned = cleaned.slice(start);

  const objectEnd = cleaned.lastIndexOf("}");
  const arrayEnd = cleaned.lastIndexOf("]");
  const end = Math.max(objectEnd, arrayEnd);

  if (end === -1) {
    throw new Error("AI response JSON is incomplete.");
  }

  return cleaned.slice(0, end + 1).trim();
}

export function ensureArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function ensureString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}
