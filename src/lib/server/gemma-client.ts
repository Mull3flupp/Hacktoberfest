import { z } from "zod";
import { ApiError } from "./http";

export class ModelError extends ApiError {
  constructor(status: number, message: string, public readonly retryable = false) { super(status, message); }
}

export function modelConfig() {
  const provider = process.env.GEMMA_PROVIDER?.trim().toLowerCase() === "google" ? "google" : "openrouter";
  return {
    provider,
    apiKey: provider === "google"
      ? process.env.GEMMA_API_KEY?.trim() || process.env.GEMINI_API_KEY?.trim()
      : process.env.GEMMA_API_KEY?.trim() || process.env.OPENROUTER_API_KEY?.trim(),
    baseUrl: (process.env.GEMMA_BASE_URL?.trim() || (provider === "google"
      ? "https://generativelanguage.googleapis.com/v1beta" : "https://openrouter.ai/api/v1")).replace(/\/$/, ""),
    model: process.env.GEMMA_MODEL?.trim() || (provider === "google" ? "gemma-4-26b-a4b-it" : "google/gemma-3-27b-it"),
  };
}

interface JsonModelRequest<T> {
  system: string;
  task: string;
  data: unknown;
  schema: z.ZodType<T>;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
}

function providerError(status: number, body: string): ModelError {
  let invalidKey = status === 401 || status === 403;
  try {
    const data = JSON.parse(body);
    // Classify only known codes. Never expose raw provider messages or details.
    const reasons = Array.isArray(data?.error?.details) ? data.error.details.map((detail: { reason?: unknown }) => detail.reason) : [];
    invalidKey ||= reasons.some((reason: unknown) => reason === "API_KEY_INVALID" || reason === "API_KEY_SERVICE_BLOCKED" || reason === "CREDENTIALS_MISSING");
  } catch { /* A non-JSON error is still safe to classify by HTTP status. */ }
  if (invalidKey) return new ModelError(502, "Gemma konnte den API-Schlüssel nicht akzeptieren. Bitte den serverseitigen Anbieterzugang prüfen.");
  if (status === 429) return new ModelError(503, "Gemmas Kontingent oder Anfragelimit ist derzeit erreicht. Bitte später erneut versuchen.");
  if (status === 404) return new ModelError(502, "Das konfigurierte Gemma-Modell ist bei diesem Anbieter nicht verfügbar.");
  return new ModelError(502, "Gemma ist gerade nicht erreichbar oder konnte die Anfrage nicht verarbeiten. Dein Spielstand bleibt unverändert.", status >= 500 || status === 408);
}

export async function requestJsonModel<T>({ system, task, data, schema, maxTokens = 3000, temperature = 0.35, timeoutMs = 45_000 }: JsonModelRequest<T>): Promise<T> {
  const config = modelConfig();
  if (!config.apiKey) throw new ModelError(503, "Gemma ist noch nicht eingerichtet. Für freie Entscheidungen wird eine echte Modellverbindung benötigt.");
  const context = `${task}\n\nKontextdaten:\n${JSON.stringify(data)}`;
  const google = config.provider === "google";
  const url = google
    ? `${config.baseUrl}/models/${encodeURIComponent(config.model.replace(/^models\//, ""))}:generateContent`
    : `${config.baseUrl}/chat/completions`;
  const body = google ? {
    // Gemma models do not consistently support systemInstruction or JSON mode.
    contents: [{ role: "user", parts: [{ text: `${system}\n\n${context}` }] }],
    generationConfig: {
      maxOutputTokens: maxTokens, temperature,
      ...(/(?:^|\/)gemma-4/i.test(config.model) ? { thinkingConfig: { thinkingLevel: "minimal" } } : {}),
    },
  } : {
    model: config.model,
    messages: [{ role: "system", content: system }, { role: "user", content: context }],
    temperature, max_tokens: maxTokens, response_format: { type: "json_object" },
  };
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: google
        ? { "x-goog-api-key": config.apiKey, "Content-Type": "application/json" }
        : { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json", "X-OpenRouter-Title": "Wenn ich König von Deutschland wäre" },
      body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs), cache: "no-store",
    });
    const raw = await response.text();
    if (!response.ok) throw providerError(response.status, raw);
    if (raw.length > 131_072) throw new ModelError(502, "Gemmas Antwort war zu groß und wurde nicht übernommen.");
    const envelope: unknown = JSON.parse(raw);
    let content: string;
    if (google) {
      const result = z.object({
        candidates: z.array(z.object({ content: z.object({ parts: z.array(z.object({ text: z.string().optional(), thought: z.boolean().optional() })) }) })).min(1),
      }).parse(envelope);
      content = result.candidates[0].content.parts.filter((part) => !part.thought).map((part) => part.text || "").join("");
    } else {
      const result = z.object({ choices: z.array(z.object({ message: z.object({ content: z.string() }) })).min(1) }).parse(envelope);
      content = result.choices[0].message.content;
    }
    const json = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    return schema.parse(JSON.parse(json));
  } catch (error) {
    if (error instanceof ModelError) throw error;
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new ModelError(502, "Gemmas Antwort hat zu lange gedauert. Bitte erneut versuchen; es wurde nichts verändert.", true);
    }
    throw new ModelError(502, "Gemma hat keine gültige strukturierte Antwort geliefert. Es wurde nichts verändert; bitte erneut versuchen.", true);
  }
}
